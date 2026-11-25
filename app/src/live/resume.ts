/** Reload stops the local promise, never the already-broadcast transaction. */
export function resumeStoredRecord<T extends {demo: any}>(record: T): T {
  return record.demo?.phase === 'judging'
    ? {...record, demo: {...record.demo, phase: 'session_open'}}
    : record;
}
