export type Phase = 'idle' | 'session_open' | 'judging' | 'verdict_ready' | 'settled';
export type Milestone = { id: string; title: string; description: string; weight: number; status: string; evidence?: string; artifactName?: string; url?: string };
export type Activity = { id: string; title: string; detail?: string; status?: string; at?: string; url?: string };
export type Service = { ready: boolean; connected?: boolean; network?: string; reason?: string; contractAddress?: string; chainId?: number };
export type Status = { mode?: string; yellow: Service; genlayer: Service; repositoryUrl?: string; busy?: boolean; error?: string };
export type Demo = {
  phase: Phase;
  caseId?: string;
  contractUrl?: string;
  settlementAllowed?: boolean;
  agreement: { title: string; budget: string; unit: string; buyer?: string; seller?: string; hash?: string };
  session?: { id?: string; status?: string; version?: number; proofUrl?: string };
  deliverables: Milestone[];
  adjudication?: { status?: string; decision?: string; summary?: string; transactionHash?: string; explorerUrl?: string; receiptHash?: string; acceptedDeliverables?: number; totalDeliverables?: number };
  allocation?: { buyer: number; seller: number; total: number; unit: string };
  signatures?: { buyer: boolean; seller: boolean };
  activity: Activity[];
};

export const emptyStatus: Status = { yellow: { ready: false }, genlayer: { ready: false } };
export const emptyDemo: Demo = {
  phase: 'idle',
  agreement: { title: 'A three-part release. A two-part delivery.', budget: '100', unit: 'demo credits' },
  deliverables: [
    { id: 'landing', title: 'Landing page', description: 'A responsive page matching the agreed brief.', weight: 40, status: 'pending' },
    { id: 'guide', title: 'Integration guide', description: 'Clear, reproducible setup instructions.', weight: 35, status: 'pending' },
    { id: 'tests', title: 'Automated tests', description: 'A passing suite covering the agreed behavior.', weight: 25, status: 'pending' },
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
  const milestones = Array.isArray(raw.deliverables) && raw.deliverables.length ? raw.deliverables : emptyDemo.deliverables;
  const buyer = number(allocation.buyer, -1), seller = number(allocation.seller, -1), total = number(allocation.total, -1);
  // Never turn a malformed split into a successful allocation chart.
  const validSplit = total > 0 && buyer >= 0 && seller >= 0 && buyer + seller === total;
  return {
    phase,
    caseId: identifier(raw.caseId ?? raw.case_id),
    contractUrl: safeLink(raw.contractUrl),
    settlementAllowed: typeof raw.settlementAllowed === 'boolean' ? raw.settlementAllowed : typeof object(raw.receipt).settlement_allowed === 'boolean' ? object(raw.receipt).settlement_allowed as boolean : undefined,
    agreement: { title: string(agreement.title, emptyDemo.agreement.title), budget: string(agreement.budget, '100'), unit: 'demo credits', buyer: optional(agreement.buyer), seller: optional(agreement.seller), hash: optional(agreement.hash) },
    session: raw.session ? { id: optional(session.id ?? session.app_session_id ?? session.appSessionId), status: optional(session.status), version: typeof session.version === 'number' ? session.version : undefined, proofUrl: safeLink(session.proofUrl) } : undefined,
    deliverables: milestones.map((value, i) => { const row = object(value); return { id: string(row.id, 'milestone-' + i), title: string(row.title, 'Milestone ' + (i + 1)), description: string(row.description), weight: number(row.weight), status: string(row.status, 'pending'), evidence: optional(row.evidence), artifactName: optional(row.artifactName ?? row.artifact_name), url: safeLink(row.url) }; }),
    adjudication: raw.adjudication ? { status: optional(adjudication.status), decision: optional(adjudication.decision), summary: optional(adjudication.summary), transactionHash: optional(adjudication.transactionHash ?? adjudication.transaction_hash), explorerUrl: safeLink(adjudication.explorerUrl), receiptHash: optional(adjudication.receiptHash ?? adjudication.receipt_hash), acceptedDeliverables: typeof adjudication.acceptedDeliverables === 'number' ? adjudication.acceptedDeliverables : undefined, totalDeliverables: typeof adjudication.totalDeliverables === 'number' ? adjudication.totalDeliverables : undefined } : undefined,
    allocation: validSplit ? { buyer, seller, total, unit: 'demo credits' } : undefined,
    signatures: raw.signatures ? { buyer: signatures.buyer === true, seller: signatures.seller === true } : undefined,
    activity: Array.isArray(raw.activity) ? raw.activity.map((value, i) => { const row = object(value); return { id: string(row.id, 'event-' + i), title: string(row.title, 'Activity'), detail: optional(row.detail), status: optional(row.status), at: optional(row.at), url: safeLink(row.url) }; }) : [],
  };
}

export function actionFor(phase: Phase) {
  return {
    idle: { path: 'session', label: 'Open demo room', detail: 'Freeze the agreement in a signed Yellow session.' },
    session_open: { path: 'adjudicate', label: 'Request a ruling', detail: 'Ask GenLayer to assess the complete frozen evidence.' },
    judging: { path: '', label: 'Jury reviewing…', detail: 'The actual consensus result will appear here.' },
    verdict_ready: { path: 'settle', label: 'Co-sign & close room', detail: 'Both sandbox agents must accept the verdict-bound proposal.' },
    settled: { path: '', label: 'Room closed', detail: 'The signed proposal is recorded. No funds were moved.' },
  }[phase];
}

export function hasRuling(demo: Demo) { return (demo.phase === 'verdict_ready' || demo.phase === 'settled') && Boolean(demo.adjudication?.decision); }
