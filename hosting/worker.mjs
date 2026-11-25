import assets from 'virtual:counterclaim-assets';
import recordedProof from '../proof/reviewer-verification-v2.json';
import courtSource from '../contracts/CounterclaimCourt.py?raw';
import {CHAIN_ID, COURT, MAX_BODY_BYTES, readRpcBody, validateRpcRequest} from './rpc-policy.mjs';
import {reserveRpcSlot} from './pacing.mjs';

const UPSTREAM = 'https://studio-dev.genlayer.com/api';
const json = (value, status = 200, extra = {}) => new Response(JSON.stringify(value), {
  status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra},
});
function rpcError(id, message, status = 400, code = -32602, extra = {}) {
  return json({jsonrpc: '2.0', id: id ?? null, error: {code, message}}, status, extra);
}

async function proxy(request, env) {
  if (request.method !== 'POST') return json({error: 'POST is required'}, 405, {Allow: 'POST'});
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({error: 'Same-origin requests only'}, 403);
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return rpcError(null, 'JSON content type is required', 415);
  const length = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return rpcError(null, 'Request body is too large', 413);
  let text;
  try {text = await readRpcBody(request);}
  catch (error) {return rpcError(null, error.message || 'Invalid request body', error.message?.includes('too large') ? 413 : 400);}
  let body;
  try {body = JSON.parse(text); await validateRpcRequest(body);}
  catch (error) {return rpcError(body?.id, error.message || 'Invalid demo RPC request');}
  let delay;
  try {delay = await reserveRpcSlot(env.DB);}
  catch {return rpcError(body.id, 'Global demo RPC scheduler is unavailable. Please try again shortly.', 503, -32005, {'Retry-After': '10'});}
  if (delay === null) return rpcError(body.id, 'The shared test network is busy. Retry this same request shortly.', 429, -32005, {'Retry-After': '8'});
  if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(UPSTREAM, {method: 'POST',
      headers: {'Content-Type': 'application/json', Origin: 'https://studio-dev.genlayer.com', 'User-Agent': 'CounterclaimLive/2.0'},
      body: text, signal: controller.signal});
    if (response.status === 429) return rpcError(body.id, 'Studio is rate limited. Retry this same request shortly.', 429, -32005, {'Retry-After': response.headers.get('Retry-After') || '12'});
    const headers = new Headers({'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
    return new Response(response.body, {status: response.status, headers});
  } catch {return rpcError(body.id, 'Studio could not be reached. A submitted transaction may still exist; resume its saved hash.', 502, -32005, {'Retry-After': '8'});}
  finally {clearTimeout(timer);}
}

function staticResponse(pathname, request) {
  const asset = assets[pathname === '/' ? '/index.html' : pathname];
  if (!asset) return new Response('Not found', {status: 404});
  const bytes = Uint8Array.from(atob(asset.base64), char => char.charCodeAt(0));
  return new Response(request.method === 'HEAD' ? null : bytes, {headers: {
    'Content-Type': asset.type,
    'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' wss://nitronode-sandbox.yellow.org; object-src 'none'; base-uri 'self'",
  }});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/rpc') return proxy(request, env);
    if (!['GET', 'HEAD'].includes(request.method)) return json({error: 'Method is not allowed'}, 405, {Allow: 'GET, HEAD'});
    if (url.pathname === '/api/proof') return json(recordedProof);
    if (url.pathname === '/api/contract') return new Response(courtSource, {headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache'}});
    if (url.pathname === '/health') {
      try {
        if (!env.DB?.prepare) throw new Error();
        await env.DB.prepare('SELECT key FROM rpc_limits LIMIT 1').first();
        return json({ok: true, chainId: CHAIN_ID, contractAddress: COURT, scheduler: 'D1_GLOBAL_3500MS', signingKeysOnServer: false});
      } catch {return json({ok: false, error: 'Global RPC scheduler is unavailable'}, 503);}
    }
    if (url.pathname.startsWith('/api/')) return json({error: 'Unknown API route'}, 404);
    return staticResponse(url.pathname, request);
  },
};
