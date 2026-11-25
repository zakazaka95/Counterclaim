export type Phase = 'idle' | 'session_open' | 'judging' | 'verdict_ready' | 'settled';
export type Milestone = { id: string; title: string; description: string; weight: number; status: string; evidence?: string; artifactName?: string; url?: string };
export type Activity = { id: string; title: string; detail?: string; status?: string; at?: string; url?: string };
export type Service = { ready: boolean; connected?: boolean; network?: string; reason?: string; contractAddress?: string; chainId?: number };
export type Status = { mode?: string; yellow: Service; genlayer: Service; repositoryUrl?: string; busy?: boolean; error?: string };
export type Demo = {
  mode?: 'recorded' | 'live';
  readOnly?: boolean;
  recordedAt?: string;
  optionalYellowConnected?: boolean;
  phase: Phase;
  caseId?: string;
  contractUrl?: string;
  settlementAllowed?: boolean;
  agreement: { title: string; budget: string; unit: string; buyer?: string; seller?: string; hash?: string };
  session?: { id?: string; status?: string; version?: number; proofUrl?: string; referenceOnly?: boolean };
  deliverables: Milestone[];
  adjudication?: { status?: string; decision?: string; summary?: string; transactionHash?: string; explorerUrl?: string; receiptHash?: string; acceptedDeliverables?: number; totalDeliverables?: number };
  allocation?: { buyer: number; seller: number; total: number; unit: string };
  signatures?: { buyer: boolean; seller: boolean };
  authorization?: { buyer: boolean; seller: boolean; deliveredBy?: string; termsHash?: string };
  escrow?: { totalWei: string; buyerWei?: string; sellerWei?: string; claims?: { buyer: boolean; seller: boolean }; claimTxs?: {buyer?: string; seller?: string}; independent: boolean };
  activity: Activity[];
};

export const emptyStatus: Status = { yellow: { ready: false }, genlayer: { ready: false } };
export const emptyDemo: Demo = {
  phase: 'idle',
  agreement: { title: 'A three-part release. A two-part delivery.', budget: '100', unit: 'demo credits' },
  deliverables: [
    { id: 'landing', title: 'Landing page', description: 'A responsive page matching the agreed brief.', weight: 40, status: 'pending' },
    { id: 'guide', title: 'Integration guide', description: 'Clear, reproducible setup instructions.', weight: 35, status: 'pending' },
    { id: 'tests', title: 'Automated tests', description: 'Test source containing the agreed assertions; execution is not certified.', weight: 25, status: 'pending' },
  ],
  activity: [],
};

type Obj = Record<string, unknown>;
function object(value: unknown): Obj { return value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {}; }
function string(value: unknown, fallback = '') { return typeof value === 'string' ? value : fallback; }
function number(value: unknown, fallback = 0) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^-?\d+(\.\d+)?$/.test(value))) return fallback;
  const result = Number(value); return Number.isFinite(result) ? result : fallback;
}
function optional(value: unknown) { return typeof value === 'string' && value.length > 0 ? value : undefined; }
function identifier(value: unknown) { return typeof value === 'number' ? Number.isSafeInteger(value) && value >= 0 ? String(value) : undefined : optional(value); }
export function safeLink(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (value === '/api/proof') return value;
  if (/^\/(?:proof|demo|recorded)\/[A-Za-z0-9._~/-]+$/.test(value) && !value.split('/').includes('..')) return value;
  try { const parsed = new URL(value); return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined; } catch { return undefined; }
}

export function normalizeStatus(value: unknown): Status {
  const raw = object(value);
  function service(value: unknown): Service {
    const row = object(value);
    return { ready: row.ready === true, connected: row.connected === true, network: optional(row.network), reason: optional(row.reason), contractAddress: optional(row.contractAddress ?? row.contract_address), chainId: typeof row.chainId === 'number' ? row.chainId : undefined };
  }
  return { mode: optional(raw.mode), yellow: service(raw.yellow), genlayer: service(raw.genlayer), repositoryUrl: safeLink(raw.repositoryUrl), busy: raw.busy === true, error: optional(raw.error) };
}

export function normalizeDemo(value: unknown): Demo {
  const envelope = object(value);
  const raw = envelope.demo ? object(envelope.demo) : envelope;
  const recognized: Phase[] = ['idle', 'session_open', 'judging', 'verdict_ready', 'settled'];
  const phase = recognized.includes(raw.phase as Phase) ? raw.phase as Phase : 'idle';
  const agreement = object(raw.agreement);
  const session = object(raw.session);
  const adjudication = object(raw.adjudication);
  const allocation = object(raw.allocation);
  const signatures = object(raw.signatures);
  const authorization = object(raw.authorization);
  const escrow = object(raw.escrow);
  const claims = object(escrow.claims);
  const claimTxs = object(escrow.claimTxs);
  const wei = (value: unknown) => typeof value === 'string' && /^\d+$/.test(value) ? value : undefined;
  const milestones = Array.isArray(raw.deliverables) && raw.deliverables.length ? raw.deliverables : emptyDemo.deliverables;
  const buyer = number(allocation.buyer, -1), seller = number(allocation.seller, -1), total = number(allocation.total, -1);
  // Never turn a malformed split into a successful allocation chart.
  const validSplit = total > 0 && buyer >= 0 && seller >= 0 && buyer + seller === total;
  return {
    mode: raw.mode === 'recorded' || raw.mode === 'live' ? raw.mode : undefined,
    readOnly: raw.readOnly === true || raw.mode === 'recorded',
    recordedAt: optional(raw.recordedAt ?? raw.observedAt),
    optionalYellowConnected: typeof raw.optionalYellowConnected === 'boolean' ? raw.optionalYellowConnected : undefined,
    phase,
    caseId: identifier(raw.caseId ?? raw.case_id),
    contractUrl: safeLink(raw.contractUrl),
    settlementAllowed: typeof raw.settlementAllowed === 'boolean' ? raw.settlementAllowed : typeof object(raw.receipt).settlement_allowed === 'boolean' ? object(raw.receipt).settlement_allowed as boolean : undefined,
    agreement: { title: string(agreement.title, emptyDemo.agreement.title), budget: string(agreement.budget, '100'), unit: 'demo credits', buyer: optional(agreement.buyer), seller: optional(agreement.seller), hash: optional(agreement.hash) },
    session: raw.session ? { id: optional(session.id ?? session.app_session_id ?? session.appSessionId), status: optional(session.status), version: typeof session.version === 'number' ? session.version : undefined, proofUrl: safeLink(session.proofUrl), referenceOnly: session.referenceOnly === true } : undefined,
    deliverables: milestones.map((value, i) => { const row = object(value); return { id: string(row.id, 'milestone-' + i), title: string(row.title, 'Milestone ' + (i + 1)), description: string(row.description), weight: number(row.weight), status: string(row.status, 'pending'), evidence: optional(row.evidence), artifactName: optional(row.artifactName ?? row.artifact_name), url: safeLink(row.url) }; }),
    adjudication: raw.adjudication ? { status: optional(adjudication.status), decision: optional(adjudication.decision), summary: optional(adjudication.summary), transactionHash: optional(adjudication.transactionHash ?? adjudication.transaction_hash), explorerUrl: safeLink(adjudication.explorerUrl), receiptHash: optional(adjudication.receiptHash ?? adjudication.receipt_hash), acceptedDeliverables: typeof adjudication.acceptedDeliverables === 'number' ? adjudication.acceptedDeliverables : undefined, totalDeliverables: typeof adjudication.totalDeliverables === 'number' ? adjudication.totalDeliverables : undefined } : undefined,
    allocation: validSplit ? { buyer, seller, total, unit: 'demo credits' } : undefined,
    signatures: raw.signatures ? { buyer: signatures.buyer === true, seller: signatures.seller === true } : undefined,
    authorization: raw.authorization ? { buyer: authorization.buyer === true, seller: authorization.seller === true, deliveredBy: optional(authorization.deliveredBy), termsHash: optional(authorization.termsHash) } : undefined,
    escrow: wei(escrow.totalWei) ? { totalWei: wei(escrow.totalWei)!, buyerWei: wei(escrow.buyerWei), sellerWei: wei(escrow.sellerWei), independent: escrow.independent === true, claims: escrow.claims ? { buyer: claims.buyer === true, seller: claims.seller === true } : undefined, claimTxs: escrow.claimTxs ? {buyer: optional(claimTxs.buyer), seller: optional(claimTxs.seller)} : undefined } : undefined,
    activity: Array.isArray(raw.activity) ? raw.activity.map((value, i) => { const row = object(value); return { id: string(row.id, 'event-' + i), title: string(row.title, 'Activity'), detail: optional(row.detail), status: optional(row.status), at: optional(row.at), url: safeLink(row.url) }; }) : [],
  };
}

export function actionFor(phase: Phase) {
  return {
    idle: { path: 'session', label: 'Open demo room', detail: 'Freeze the agreement in a signed Yellow session. Isolated agents use faucet test GEN.' },
    session_open: { path: 'adjudicate', label: 'Request a ruling', detail: 'Ask GenLayer to assess the complete frozen evidence.' },
    judging: { path: '', label: 'Jury reviewing…', detail: 'The actual consensus result will appear here.' },
    verdict_ready: { path: 'settle', label: 'Claim the escrow awards', detail: 'Each agent claims its own award on GenLayer. The other party cannot block it.' },
    settled: { path: '', label: 'Awards claimed', detail: 'Faucet test GEN only. Yellow closure is a separate optional step.' },
  }[phase];
}

export function hasRuling(demo: Demo) { return (demo.phase === 'verdict_ready' || demo.phase === 'settled') && Boolean(demo.adjudication?.decision); }

export function formatWei(value?: string): string {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return '—';
  const amount = BigInt(value), unit = 10n ** 18n;
  const fractional = (amount % unit).toString().padStart(18, '0').replace(/0+$/, '');
  return (amount / unit).toString() + (fractional ? '.' + fractional : '');
}

const positive = (value?: string) => typeof value === 'string' && /^\d+$/.test(value) && BigInt(value) > 0n;
export const isRecordedDemo = (demo: Demo) => demo.readOnly === true || demo.mode === 'recorded';

export function actionForDemo(demo: Demo) {
  if (isRecordedDemo(demo)) return {path: 'session', label: 'Start live demo', detail: 'Run your own case with two disposable browser accounts and faucet test GEN.'};
  if (demo.mode === 'live' && demo.phase === 'idle') return {path: 'session', label: 'Resume demo setup', detail: 'Keep this tab open. Setup resumes with the same isolated browser accounts.'};
  if (demo.mode === 'live' && demo.phase === 'session_open') return {path: 'adjudicate', label: 'Fund & request a ruling', detail: 'The buyer funds 0.001 test GEN. The seller accepts and delivers, then GenLayer reviews.'};
  if (demo.phase === 'verdict_ready') {
    if (demo.settlementAllowed === false || demo.adjudication?.decision !== 'RESOLVED') return {path: '', label: 'Review inconclusive', detail: 'No award is guessed. The agreed refund deadline governs recovery.'};
    if (demo.escrow) {
      if (positive(demo.escrow.sellerWei) && !demo.escrow.claims?.seller) return {path: 'settle', label: 'Claim seller award', detail: 'Only the seller signs this claim. The buyer and Yellow cannot block it.'};
      if (positive(demo.escrow.buyerWei) && !demo.escrow.claims?.buyer) return {path: 'settle', label: positive(demo.escrow.sellerWei) ? 'Claim buyer award (optional)' : 'Claim buyer award', detail: positive(demo.escrow.sellerWei) ? 'The seller is paid. The buyer can independently claim the remaining reserved award.' : 'The buyer independently claims its native entitlement. No peer signature is required.'};
      return {path: '', label: 'Awards claimed', detail: 'Every positive native entitlement has been claimed. Yellow closure remains optional.'};
    }
  }
  return actionFor(demo.phase);
}

export function claimHeadline(demo: Demo): string {
  if (isRecordedDemo(demo)) return 'Recorded · 24 Nov 2026';
  if (demo.escrow?.claims?.seller && positive(demo.escrow.sellerWei) && positive(demo.escrow.buyerWei) && !demo.escrow.claims.buyer) return 'Seller paid; buyer reserved';
  if (demo.phase === 'settled') return 'Awards claimed';
  if (demo.phase === 'judging') return 'Jury reviewing';
  if (hasRuling(demo)) return demo.settlementAllowed === false ? 'Needs clarity' : 'Awards ready';
  return demo.authorization?.deliveredBy ? 'Delivery registered' : demo.caseId !== undefined ? 'Case funded' : demo.session?.id ? 'Live demo prepared' : 'Ready to begin';
}
