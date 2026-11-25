export const RPC_INTERVAL_MS = 3500;
export const MAX_QUEUE_MS = 20_000;

// One atomic upsert orders all visitors and Worker isolates through D1.
// Only the next available time is stored; no IP, wallet or content is retained.
export async function reserveRpcSlot(db, now = Date.now()) {
  if (!db?.prepare) throw new Error('Global RPC scheduler is unavailable');
  const row = await db.prepare(`INSERT INTO rpc_limits (key, next_at) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET next_at = MAX(rpc_limits.next_at, ?) + ?
    WHERE rpc_limits.next_at <= ?
    RETURNING next_at - ? AS slot`).bind('studio', now + RPC_INTERVAL_MS,
      now, RPC_INTERVAL_MS, now + MAX_QUEUE_MS, RPC_INTERVAL_MS).first();
  if (!row) return null;
  if (!Number.isSafeInteger(row.slot) || row.slot < 0) throw new Error('Invalid global RPC schedule');
  return Math.max(0, row.slot - now);
}
