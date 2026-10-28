import { keyedProviders } from '$lib/local-ai-keys';
import { DEFAULT_KIE_BASE_URL } from '$lib/server/kie';
import { DEFAULT_LLM_BASE_URL } from '$lib/server/llm';
import { DEFAULT_HIGGSFIELD_BASE_URL } from '$lib/server/higgsfield';
import { DEFAULT_WIRO_BASE_URL, wiroAuthHeaders } from '$lib/server/wiro';
import { ELEVENLABS_BASE_URL } from '$lib/server/elevenlabs';

type Env = Record<string, string | undefined>;
type Probe = { url: string; init: RequestInit };

export enum KeyVerdict {
  Works = 'works',
  Rejected = 'rejected',
  Unreachable = 'unreachable'
}

export type KeyCheck = { provider: string; verdict: KeyVerdict };

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const UNKNOWN_TASK = 'feega-key-check';
const AUTH_REFUSED = new Set([401, 403]);
const CHECK_TIMEOUT_MS = 10_000;

const base = (configured: string | undefined, fallback: string) => (configured?.trim() || fallback).replace(/\/$/, '');

const key = (value: string | undefined) => value?.trim() ?? '';

const bearer = (token: string | undefined) => ({ Authorization: `Bearer ${key(token)}` });

const FREE_PROBES: Readonly<Record<string, (env: Env) => Probe>> = {
  kie: (env) => ({ url: `${base(env.KIE_BASE_URL, DEFAULT_KIE_BASE_URL)}/chat/credit`, init: { method: 'GET', headers: bearer(env.KIE_API_KEY) } }),
  openrouter: (env) => ({ url: `${OPENROUTER_BASE_URL}/key`, init: { method: 'GET', headers: bearer(env.OPENROUTER_API_KEY) } }),
  llm: (env) => ({ url: `${base(env.LLM_BASE_URL, DEFAULT_LLM_BASE_URL)}/key`, init: { method: 'GET', headers: bearer(env.LLM_API_KEY) } }),
  higgsfield: (env) => ({
    url: `${base(env.HIGGSFIELD_BASE_URL, DEFAULT_HIGGSFIELD_BASE_URL)}/requests/${UNKNOWN_TASK}/status`,
    init: { method: 'GET', headers: { Authorization: `Key ${key(env.HIGGSFIELD_API_KEY_ID)}:${key(env.HIGGSFIELD_API_KEY_SECRET)}` } }
  }),
  wiro: (env) => ({
    url: `${base(env.WIRO_BASE_URL, DEFAULT_WIRO_BASE_URL)}/Task/Detail`,
    init: {
      method: 'POST',
      headers: { ...wiroAuthHeaders({ apiKey: key(env.WIRO_API_KEY), apiSecret: key(env.WIRO_API_SECRET) || undefined }), 'content-type': 'application/json' },
      body: JSON.stringify({ taskid: UNKNOWN_TASK })
    }
  }),
  elevenlabs: (env) => ({ url: `${base(env.ELEVENLABS_BASE_URL, ELEVENLABS_BASE_URL)}/v1/user`, init: { method: 'GET', headers: { 'xi-api-key': key(env.ELEVENLABS_API_KEY) } } })
};

async function verdictOf(probe: Probe, doFetch: typeof fetch): Promise<KeyVerdict> {
  try {
    const res = await doFetch(probe.url, { ...probe.init, signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
    return AUTH_REFUSED.has(res.status) ? KeyVerdict.Rejected : KeyVerdict.Works;
  } catch {
    return KeyVerdict.Unreachable;
  }
}

export function checkLocalKeys(env: Env, doFetch: typeof fetch = fetch): Promise<KeyCheck[]> {
  return Promise.all(keyedProviders(env).map(async ({ name }) => ({ provider: name, verdict: await verdictOf(FREE_PROBES[name](env), doFetch) })));
}
