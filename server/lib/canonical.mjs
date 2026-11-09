import { createHash } from 'node:crypto';

export function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  throw new TypeError('Canonical payloads require JSON primitives and safe integer numbers.');
}

export function hashJson(value) { return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex'); }
export function hashText(value) { return createHash('sha256').update(value, 'utf8').digest('hex'); }
export function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item));
}
export function assertHash(value, label = 'Hash') {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error(label + ' must be a lowercase SHA-256 hash without 0x.');
  return value;
}
