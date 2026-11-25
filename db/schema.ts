import {integer, sqliteTable, text} from 'drizzle-orm/sqlite-core';

// A single shared scheduling record. No visitor identifiers or case data.
export const rpcLimits = sqliteTable('rpc_limits', {
  key: text('key').primaryKey(),
  nextAt: integer('next_at').notNull(),
});
