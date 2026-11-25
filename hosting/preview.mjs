/** Loopback QA server. Its SQLite scheduler is ephemeral, not production D1. */
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFile, readdir} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import worker from '../dist/server/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.COUNTERCLAIM_PREVIEW_PORT || 5178);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid loopback preview port');
const database = new DatabaseSync(':memory:');
const migrations = (await readdir(path.join(ROOT, 'drizzle'))).filter(name => name.endsWith('.sql')).sort();
if (!migrations.length) throw new Error('Generate the scheduler migration before starting preview');
for (const filename of migrations) database.exec(await readFile(path.join(ROOT, 'drizzle', filename), 'utf8'));

const DB = {prepare(sql) {
  const statement = database.prepare(sql);
  return {bind(...values) {return {async first() {return statement.get(...values) ?? null;}};},
    async first() {return statement.get() ?? null;}};
}};
const server = http.createServer(async (incoming, outgoing) => {
  try {
    const headers = new Headers();
    for (let i = 0; i < incoming.rawHeaders.length; i += 2) headers.append(incoming.rawHeaders[i], incoming.rawHeaders[i + 1]);
    const method = incoming.method || 'GET';
    const request = new Request(new URL(incoming.url || '/', `http://127.0.0.1:${port}`), {
      method, headers, ...(!['GET', 'HEAD'].includes(method) ? {body: Readable.toWeb(incoming), duplex: 'half'} : {}),
    });
    const response = await worker.fetch(request, {DB}, {waitUntil(promise) {promise.catch(() => {});}});
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (!response.body) outgoing.end();
    else Readable.fromWeb(response.body).pipe(outgoing);
  } catch (error) {
    if (!outgoing.headersSent) outgoing.writeHead(500, {'Content-Type': 'application/json'});
    outgoing.end(JSON.stringify({error: 'Local preview request failed', detail: error.message}));
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Counterclaim local Worker preview: http://127.0.0.1:${port} (ephemeral SQLite scheduler)`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  server.close(() => {database.close(); process.exit(0);});
  server.closeIdleConnections();
});
