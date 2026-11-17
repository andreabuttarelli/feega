import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import DOC_STAMP from 'virtual:motion-doc-stamp';
import { parseMotionDoc, type DocVerdict, type MotionDoc } from '@feega/motion-core/motion/doc';

const SEAL = '$seal';
const INSECURE_DEFAULT = 'dev-insecure-secret-change-me';

type Raw = Record<string, unknown>;

function sealKey(): Buffer | null {
  const secret = env.APP_SECRET;
  if (!secret || secret === INSECURE_DEFAULT) {
    return null;
  }
  return createHash('sha256').update(`motion-doc:${secret}`).digest();
}

const signature = (key: Buffer, body: string) => createHmac('sha256', key).update(`${DOC_STAMP}\n${body}`).digest('base64url');

const jsonbKeyOrder = (a: string, b: string) => Buffer.byteLength(a) - Buffer.byteLength(b) || (a < b ? -1 : a > b ? 1 : 0);

function inJsonbOrder(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(inJsonbOrder);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const object = value as Raw;
  return Object.fromEntries(Object.keys(object).sort(jsonbKeyOrder).map((k) => [k, inJsonbOrder(object[k])]));
}

export function sealDoc(doc: MotionDoc): MotionDoc {
  const key = sealKey();
  if (!key) {
    return doc;
  }
  const ordered = inJsonbOrder(doc) as Raw;
  return { ...ordered, [SEAL]: `${DOC_STAMP}.${signature(key, JSON.stringify(ordered))}` } as unknown as MotionDoc;
}

function trusted(stored: unknown): MotionDoc | null {
  const key = sealKey();
  if (!key || !stored || typeof stored !== 'object') {
    return null;
  }
  const { [SEAL]: seal, ...doc } = stored as Raw;
  const prefix = `${DOC_STAMP}.`;
  if (typeof seal !== 'string' || !seal.startsWith(prefix)) {
    return null;
  }
  const given = Buffer.from(seal.slice(prefix.length));
  const expected = Buffer.from(signature(key, JSON.stringify(doc)));
  return given.length === expected.length && timingSafeEqual(given, expected) ? (doc as MotionDoc) : null;
}

export function openDoc(stored: unknown): DocVerdict {
  const doc = trusted(stored);
  return doc ? { ok: true, doc } : parseMotionDoc(stored);
}
