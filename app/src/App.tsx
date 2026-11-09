import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { actionFor, emptyDemo, emptyStatus, hasRuling, normalizeDemo, normalizeStatus, safeLink } from './model';
import type { Demo, Milestone, Status } from './model';

function Icon({ name, size = 18, ...props }: { name: string; size?: number; className?: string }) {
  const paths: Record<string, ReactNode> = {
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    diagonal: <><path d="M6 18 18 6M6 6h12v12" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h6" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    link: <><path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(0 0) scale(.96)" /></>,
    scales: <><path d="M12 3v17M7 21h10M5 6h14M5 6 2 13h6L5 6ZM19 6l-3 7h6l-3-7Z" /><path d="M2 13c0 3 6 3 6 0M16 13c0 3 6 3 6 0" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 2M18 17a7 7 0 0 1-12 1l-2-2" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v.01" /></>,
    code: <><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" /></>,
    fingerprint: <><path d="M4 12a8 8 0 0 1 16 0M7 12a5 5 0 0 1 10 0c0 4-.4 6-1.6 8M10 13a2 2 0 0 1 4 0c0 4-.2 6-1 8M4 16c0 2 .4 4 1 5M7 16c0 2 .3 3.6 1 5M20 16c0 2-.3 3.3-.9 4.7" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] ?? paths.info}</svg>;
}

const truncate = (value?: string, width = 7) => value ? `${value.slice(0, width)}…${value.slice(-4)}` : 'Not created';
function External({ href, children, className = '' }: { href?: string; children: ReactNode; className?: string }) {
  const url = safeLink(href);
  return url ? <a className={className} href={url} target="_blank" rel="noreferrer">{children}<Icon name="diagonal" size={13} /></a> : <span className={className}>{children}</span>;
}

async function request(path: string, method = 'GET') {
  const response = await fetch(path, { method, headers: { Accept: 'application/json', ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) }, ...(method === 'POST' ? { body: '{}' } : {}) });
  const text = await response.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new Error('The demo service is unavailable. Start the coordinator and reconnect.'); }
  if (!response.ok) {
    const row = body && typeof body === 'object' ? body as Record<string, unknown> : {};
    const error = typeof row.error === 'string' ? row.error : typeof row.message === 'string' ? row.message : 'The request could not be completed.';
    throw new Error(error.slice(0, 600));
  }
  return body;
}

function Step({ number, title, detail, active, complete }: { number: number; title: string; detail: string; active: boolean; complete: boolean }) {
  return <div className={`step ${active ? 'is-active' : ''} ${complete ? 'is-complete' : ''}`}>
    <div className="step-number">{complete ? <Icon name="check" size={15} /> : `0${number}`}</div>
    <div><strong>{title}</strong><span>{detail}</span></div>
  </div>;
}

function EvidenceDialog({ milestone, onClose }: { milestone: Milestone | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (milestone && !dialog.current?.open) dialog.current?.showModal(); if (!milestone && dialog.current?.open) dialog.current.close(); }, [milestone]);
  return <dialog ref={dialog} className="evidence-dialog" onCancel={onClose} onClick={(event) => { if (event.target === dialog.current) onClose(); }} aria-labelledby="evidence-title">
    {milestone && <div className="dialog-inner">
      <div className="dialog-top"><span className="eyebrow">Frozen evidence · {milestone.weight} credits</span><button type="button" className="icon-button" aria-label="Close evidence" onClick={onClose}><Icon name="close" /></button></div>
      <h2 id="evidence-title">{milestone.title}</h2>
      <p className="dialog-description">{milestone.description}</p>
      <div className="evidence-document"><div><Icon name="file" /><span>{milestone.artifactName ?? 'Submitted record'}</span></div><p>{milestone.evidence ?? 'No evidence has been supplied for this milestone. The jury must judge the recorded material against the agreement, rather than assume delivery.'}</p></div>
      <div className="dialog-note"><Icon name="lock" size={16} /><p>Agreement and evidence are frozen before the ruling. These are synthetic demonstration records.</p></div>
      {milestone.url && <External href={milestone.url} className="text-link">Open source evidence</External>}
      <button type="button" className="button button-dark dialog-button" onClick={onClose}>Back to the case<Icon name="arrow" /></button>
    </div>}
  </dialog>;
}

export default function App() {
  const [demo, setDemo] = useState<Demo>(emptyDemo);
  const [status, setStatus] = useState<Status>(emptyStatus);
  const [connection, setConnection] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissedRemoteError, setDismissedRemoteError] = useState<string | undefined>();
  const [evidence, setEvidence] = useState<Milestone | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const refresh = useCallback(async (showError = true) => {
    const [statusResult, demoResult] = await Promise.allSettled([request('/api/status'), request('/api/demo')]);
    if (statusResult.status === 'fulfilled') setStatus(normalizeStatus(statusResult.value));
    if (demoResult.status === 'fulfilled') setDemo(normalizeDemo(demoResult.value));
    const connected = statusResult.status === 'fulfilled' && demoResult.status === 'fulfilled';
    setConnection(connected ? 'online' : 'offline');
    if (!connected && showError) setError('The coordinator is not reachable. Start the demo service, then reconnect. No room or ruling has been created.');
  }, []);
  useEffect(() => { void refresh(false); }, [refresh]);
  useEffect(() => { const timer = window.setInterval(() => void refresh(false), demo.phase === 'judging' || busy ? 3000 : 9000); return () => window.clearInterval(timer); }, [busy, demo.phase, refresh]);

  const ruling = hasRuling(demo);
  const proposalAllowed = ruling && (demo.settlementAllowed ?? Boolean(demo.allocation));
  const action = demo.phase === 'verdict_ready' && !proposalAllowed ? { path: '', label: 'More evidence needed', detail: 'The ruling is inconclusive. No final proposal can be co-signed.' } : actionFor(demo.phase);
  const phaseIndex = { idle: 0, session_open: 1, judging: 1, verdict_ready: 2, settled: 3 }[demo.phase];
  const yellowNeeded = action.path === 'session' || action.path === 'settle';
  const working = Boolean(busy) || status.busy === true;
  const canAct = connection === 'online' && !working && Boolean(action.path) && (yellowNeeded ? status.yellow.ready : status.genlayer.ready);
  const visibleError = error ?? (status.error !== dismissedRemoteError ? status.error : undefined);
  const accepted = demo.adjudication?.acceptedDeliverables;
  const split = proposalAllowed ? demo.allocation : undefined;
  const sellerPercent = split ? split.seller / split.total * 100 : 0;
  const signatures = demo.signatures;
  const activity = [...demo.activity].reverse();

  async function perform(path: string) {
    if (working) return;
    setBusy(path); setError(null);
    try {
      const body = await request(`/api/demo/${path}`, 'POST');
      if (body && typeof body === 'object' && ('phase' in body || 'demo' in body)) setDemo(normalizeDemo(body));
      await refresh(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The action failed. Your previous state is preserved.'); }
    finally { setBusy(null); }
  }

  return <div className="app-shell">
    <header className="site-header">
      <a className="wordmark" href="#" aria-label="Counterclaim home"><span className="wordmark-symbol" aria-hidden="true"><i /><i /></span>counterclaim<span className="wordmark-period">.</span></a>
      <nav aria-label="Main navigation"><a className="nav-active" href="#case">Demo room</a><button type="button" onClick={() => setHelpOpen(value => !value)} aria-expanded={helpOpen}>How it works</button><External href={status.repositoryUrl} className="source-nav">Source</External></nav>
      <div className="environment"><span />Sandbox<span className="environment-divider">/</span><span className="no-funds">No funds moved</span></div>
    </header>

    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy"><div className="eyebrow hero-eyebrow"><span className="small-cross">+</span> Agreements for an agentic world</div><h1 id="hero-title">A fair way<br /><em>forward.</em></h1><p>Agents can disagree.<br className="mobile-break" /> Their deals shouldn’t get stuck.</p></div>
        <div className="hero-diagram" aria-label="Agreement, independent judgment, co-signed outcome">
          <div className="diagram-line" /><div className="diagram-line line-two" />
          <div className="agent-node node-buyer"><div className="agent-glyph">B<span /></div><div><span>BUYER AGENT</span><strong>“The tests are missing.”</strong></div></div>
          <div className="court-node"><div className="court-node-inside"><Icon name="scales" size={32} /></div><span>Evidence over argument.</span></div>
          <div className="agent-node node-seller"><div className="agent-glyph seller-glyph">S<span /></div><div><span>SELLER AGENT</span><strong>“The release is complete.”</strong></div></div>
          <div className="diagram-caption"><span className="mini-square" /> One agreement. One shared way to resolve it.</div>
        </div>
      </section>

      <section className="partner-strip" aria-label="Integration partners"><span className="partner-caption">Built with</span><a href="https://yellow.org/" target="_blank" rel="noreferrer" aria-label="Yellow"><img className="yellow-mark" src="/brand/yellow-logo.svg" alt="Yellow" /></a><span className="partner-plus">×</span><a href="https://internetcourt.org/" target="_blank" rel="noreferrer" aria-label="Internet Court"><img className="court-mark" src="/brand/internet-court-logo.svg" alt="Internet Court" /></a><span className="partner-plus">×</span><a href="https://genlayer.com/" target="_blank" rel="noreferrer" aria-label="GenLayer"><img className="genlayer-mark" src="/brand/genlayer-logo.svg" alt="GenLayer" /></a><span className="partner-right">Partner Demo Lab <Icon name="diagonal" size={14} /></span></section>

      {helpOpen && <section className="how-panel" id="how-it-works"><div><span className="eyebrow">01 · Agree</span><h3>Freeze the deal.</h3><p>Two isolated test agents sign the same agreement and evidence in a real Yellow sandbox session.</p></div><div><span className="eyebrow">02 · Review</span><h3>Let the evidence speak.</h3><p>A GenLayer contract evaluates the complete delivery against the frozen acceptance criteria.</p></div><div><span className="eyebrow">03 · Co-sign</span><h3>Find a way forward.</h3><p>Both agents co-sign a verdict-bound proposal. This demo moves zero tokens; the split uses nonmonetary credits.</p></div></section>}

      <section className="case-section" id="case" aria-labelledby="case-title">
        <div className="section-header"><div><div className="eyebrow">THE DEMO ROOM <span className="label-separator">/</span> {demo.caseId !== undefined ? `GENLAYER CASE ${demo.caseId}` : 'CASE PENDING'}</div><h2 id="case-title">{proposalAllowed && accepted !== undefined ? `${demo.deliverables.length} promised. ${accepted} accepted.` : 'Three milestones. One disagreement.'}</h2></div><div className={`case-status ${demo.phase === 'settled' ? 'status-success' : ''}`}><span />{demo.phase === 'settled' ? 'Resolved together' : demo.phase === 'judging' ? 'Jury reviewing' : ruling ? proposalAllowed ? 'Proposal ready' : 'Needs clarity' : demo.session?.id ? 'Room open' : 'Ready to begin'}</div></div>

        <div className="journey" aria-label="Case progress"><Step number={1} title="The agreement" detail="Terms & evidence frozen" active={phaseIndex === 0} complete={phaseIndex > 0} /><div className="step-connector" /><Step number={2} title="The ruling" detail="GenLayer reviews the case" active={phaseIndex === 1} complete={phaseIndex > 1} /><div className="step-connector" /><Step number={3} title="The way forward" detail="Both agents co-sign" active={phaseIndex === 2} complete={phaseIndex === 3} /></div>

        {visibleError && <div className="error-message" role="alert"><Icon name="info" size={20} /><div><strong>That step didn’t complete.</strong><p>{visibleError}</p></div><button type="button" className="icon-button" onClick={() => { setError(null); setDismissedRemoteError(status.error); }} aria-label="Dismiss error"><Icon name="close" size={18} /></button></div>}

        <div className="case-grid" data-testid="case-workspace">
          <div className="case-main">
            <section className="agreement-panel" data-testid="agreement-panel" aria-label="Frozen agreement">
              <div className="panel-heading"><span className="eyebrow">THE AGREEMENT</span><span className="quiet-badge"><Icon name={demo.session?.id ? 'lock' : 'file'} size={13} />{demo.session?.id ? 'Frozen on Yellow' : 'Synthetic case fixture'}</span></div>
              <div className="agreement-summary"><h3>Release<br />handoff.</h3><div className="credit-amount"><span>{demo.agreement.budget}</span><p>demo credits<small>Nonmonetary allocation</small></p></div></div>
              <p className="agreement-description">Three milestones, agreed in advance. Delivered work earns its weight. Undelivered work stays with the buyer.</p>
              <div className="parties"><div><span className="party-avatar buyer-avatar">B</span><div><strong>Buyer agent</strong><span>{demo.agreement.buyer ? truncate(demo.agreement.buyer) : 'Commissioned the release'}</span></div></div><span className="party-connection"><Icon name="link" size={16} /></span><div><span className="party-avatar seller-avatar">S</span><div><strong>Seller agent</strong><span>{demo.agreement.seller ? truncate(demo.agreement.seller) : 'Responsible for delivery'}</span></div></div></div>
            </section>

            <section className="evidence-panel" data-testid="evidence-panel" aria-labelledby="evidence-heading"><div className="panel-heading"><div><span className="eyebrow">THE EVIDENCE</span><h3 id="evidence-heading">What actually arrived.</h3></div><span className="evidence-count">{ruling && accepted !== undefined ? `${accepted}/${demo.deliverables.length} accepted` : `${demo.deliverables.length} milestones`}</span></div>
              <div className="milestones">{demo.deliverables.map((milestone, index) => {
                const missing = ['missing', 'not_delivered', 'absent', 'rejected', 'not_satisfied', 'not-satisfied', 'failed'].includes(milestone.status.toLowerCase());
                const verified = ruling && ['accepted', 'delivered', 'pass', 'satisfied'].includes(milestone.status.toLowerCase());
                const supplied = Boolean(milestone.evidence) || ['submitted', 'provided', 'accepted', 'delivered', 'pass', 'satisfied'].includes(milestone.status.toLowerCase());
                return <button type="button" className={`milestone ${missing ? 'milestone-missing' : ''}`} onClick={() => setEvidence(milestone)} key={milestone.id}><span className={`milestone-icon ${verified ? 'verified-icon' : ''}`}>{verified ? <Icon name="check" size={17} /> : missing ? <span className="missing-dash" /> : <Icon name="file" size={18} />}</span><span className="milestone-text"><strong>{milestone.title}</strong><span>{milestone.description || `Milestone ${index + 1} acceptance criteria`}</span></span><span className={`milestone-status ${missing ? 'missing-status' : verified ? 'verified-status' : ''}`}>{missing ? 'Not delivered' : verified ? 'Accepted' : supplied ? 'Submitted' : 'Review criteria'}</span><span className="milestone-weight">{milestone.weight}<small>credits</small></span><Icon name="diagonal" size={14} /></button>;
              })}</div>
              <div className="evidence-footnote"><Icon name="fingerprint" size={17} /><span>Complete evidence is bound to the agreement before the ruling.</span>{demo.agreement.hash && <code title={demo.agreement.hash}>{truncate(demo.agreement.hash, 8)}</code>}</div>
            </section>
          </div>

          <aside className={`outcome-panel ${ruling ? 'has-ruling' : ''}`} data-testid="outcome-panel" aria-label="Ruling and proposed split">
            <div className="outcome-top"><span className="eyebrow">THE WAY FORWARD</span><div className="small-court-symbol"><Icon name="scales" size={18} /></div></div>
            {ruling ? <><div className="ruling-tag"><span />{demo.phase === 'settled' ? 'Co-signed outcome' : 'GenLayer ruling received'}</div>{proposalAllowed ? <h3>Credit where<br /><em>it’s due.</em></h3> : <h3>Room for<br /><em>more clarity.</em></h3>}<p className="outcome-description">{demo.adjudication?.summary ?? 'The agreed evidence has been assessed. Both agents can now accept the proposed split.'}</p></> : <><div className="ruling-tag muted-ruling"><span />{demo.phase === 'judging' ? 'Actual consensus in progress' : 'Independent review'}</div><h3>A resolution,<br /><em>not a stalemate.</em></h3><p className="outcome-description">The complete agreement and delivery record go to GenLayer. A ruling becomes a proposal both agents can accept.</p></>}

            <div className={`split-graphic ${split ? 'split-ready' : ''}`} aria-label={split ? `Proposed split: seller ${split.seller}, buyer ${split.buyer} demo credits` : 'Split awaits a real GenLayer ruling'}>
              <div className="split-heading"><span>Proposed split</span><span>{split ? `${split.total} credits` : 'Awaiting ruling'}</span></div>
              <div className="allocation-bar"><div className="seller-allocation" style={{ flexBasis: `${split ? sellerPercent : 50}%`, ...(split?.seller === 0 ? { padding: 0 } : {}) }}>{split ? split.seller : '—'}</div><div className="buyer-allocation" style={split ? { flexBasis: `${100 - sellerPercent}%`, flexGrow: 0, ...(split.buyer === 0 ? { padding: 0 } : {}) } : undefined}>{split ? split.buyer : '—'}</div></div>
              <div className="allocation-labels"><span><i />Seller agent{split ? ` · ${split.seller}` : ''}</span><span><i />Buyer agent{split ? ` · ${split.buyer}` : ''}</span></div>
            </div>

            <div className="signatures"><div><span className={`signature-mark ${signatures?.buyer ? 'signed' : ''}`}>{signatures?.buyer ? <Icon name="check" size={12} /> : <Icon name="fingerprint" size={12} />}</span><span>Buyer signature</span><small>{signatures?.buyer ? 'Signed' : 'Required'}</small></div><div><span className={`signature-mark ${signatures?.seller ? 'signed' : ''}`}>{signatures?.seller ? <Icon name="check" size={12} /> : <Icon name="fingerprint" size={12} />}</span><span>Seller signature</span><small>{signatures?.seller ? 'Signed' : 'Required'}</small></div></div>

            <button type="button" data-testid="primary-action" className={`button button-primary ${demo.phase === 'settled' ? 'button-finished' : ''}`} disabled={!canAct} aria-busy={working} onClick={() => void perform(action.path)}>{working ? <><span className="spinner" />{busy === 'session' ? 'Opening signed room…' : busy === 'adjudicate' ? 'Submitting for review…' : busy === 'settle' ? 'Co-signing proposal…' : 'Network request running…'}</> : <>{action.label}<Icon name={demo.phase === 'settled' ? 'check' : demo.phase === 'judging' ? 'clock' : 'arrow'} size={19} /></>}</button>
            <p className="action-detail">{connection !== 'online' ? connection === 'connecting' ? 'Connecting to the demonstration service…' : 'Start the coordinator to run the real sandbox demo.' : working ? 'Waiting for the actual protocol response. Consensus can take a few minutes.' : !canAct && action.path ? (yellowNeeded ? status.yellow.reason : status.genlayer.reason) ?? 'This service needs configuration before the next step.' : action.detail}</p>
            <div className="outcome-boundary"><Icon name="info" size={13} /><span>Demo credits only. Yellow token allocations stay at zero.</span></div>
          </aside>
        </div>

        <section className="proof-panel" data-testid="proof-panel" aria-labelledby="proof-heading"><div className="proof-title"><div><span className="eyebrow">A SHARED RECORD</span><h3 id="proof-heading">Every step leaves a trace.</h3></div><button type="button" className="subtle-button" onClick={() => void refresh()} disabled={Boolean(busy)}><Icon name="refresh" size={14} />Refresh record</button></div><div className="proof-items"><div><span className="proof-icon"><Icon name="link" size={17} /></span><div><span>Yellow room</span><External href={demo.session?.proofUrl}>{truncate(demo.session?.id, 10)}</External></div>{demo.session?.status && <span className="record-status">{demo.session.status}</span>}</div><div><span className="proof-icon"><Icon name="scales" size={17} /></span><div><span>GenLayer decision</span><External href={demo.adjudication?.explorerUrl}>{demo.adjudication?.transactionHash ? truncate(demo.adjudication.transactionHash, 10) : 'Not requested'}</External></div>{demo.adjudication?.status && <span className="record-status">{demo.adjudication.status}</span>}</div><div><span className="proof-icon"><Icon name="fingerprint" size={17} /></span><div><span>Receipt fingerprint</span><code title={demo.adjudication?.receiptHash}>{truncate(demo.adjudication?.receiptHash, 10)}</code></div></div></div>
          {activity.length > 0 && <details className="activity"><summary>View the complete case timeline<span>{activity.length} events<Icon name="arrow" size={13} /></span></summary><ol>{activity.map((event) => <li key={event.id}><span className={`activity-dot ${event.status === 'failed' ? 'failed-dot' : ''}`} /><div><strong><External href={event.url}>{event.title}</External></strong>{event.detail && <p>{event.detail}</p>}</div>{event.at && <time dateTime={event.at}>{new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>}</li>)}</ol></details>}
        </section>

        <div className="service-strip"><div className="services"><span className={`service ${status.yellow.ready ? 'service-ready' : ''}`}><i />Yellow <small>{status.yellow.network ?? 'Sandbox'}</small></span><span className={`service ${status.genlayer.ready ? 'service-ready' : ''}`}><i />GenLayer <small>{status.genlayer.network ?? 'Test network'}</small></span></div><button type="button" className="subtle-button" onClick={() => connection === 'offline' ? void refresh() : void perform('reset')} disabled={working || demo.phase === 'judging'}><Icon name="refresh" size={13} />{connection === 'offline' ? 'Reconnect services' : 'Start another case'}</button></div>
      </section>
    </main>

    <footer className="site-footer"><div><a className="wordmark footer-wordmark" href="#">counterclaim<span className="wordmark-period">.</span></a><p>Better agreements. A fair way forward.</p></div><div className="footer-note">A reproducible partner demonstration.<br />Synthetic agents. Real protocol interactions. Zero funds moved.</div><External href={status.repositoryUrl} className="footer-source"><Icon name="code" size={16} />Explore the code</External></footer>
    <EvidenceDialog milestone={evidence} onClose={() => setEvidence(null)} />
  </div>;
}
