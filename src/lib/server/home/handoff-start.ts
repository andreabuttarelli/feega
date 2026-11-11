import type { Cookies } from '@sveltejs/kit';
import { HANDOFF_NONCE, HandoffStart, handoffOf, type Handoff } from '$lib/home/handoff';

export const USED_HANDOFFS_COOKIE = 'feega_handoffs_used';
const USED_KEPT = 20;
const USED_MAX_AGE_S = 60 * 60 * 24 * 30;
const USED_SEPARATOR = '.';

const waitsForInput = (handoff: Handoff) => handoff.source !== null || handoff.waitsForImages || !handoff.text;

function claim(cookies: Cookies, nonce: string): boolean {
  const used = (cookies.get(USED_HANDOFFS_COOKIE) ?? '').split(USED_SEPARATOR).filter(Boolean);
  if (used.includes(nonce)) {
    return false;
  }

  const kept = [...used, nonce].slice(-USED_KEPT).join(USED_SEPARATOR);
  cookies.set(USED_HANDOFFS_COOKIE, kept, { path: '/', maxAge: USED_MAX_AGE_S, sameSite: 'lax', httpOnly: true });
  return true;
}

export function startHandoff(params: URLSearchParams, cookies: Cookies): HandoffStart {
  const handoff = handoffOf(params);
  if (!handoff) {
    return HandoffStart.None;
  }

  const nonce = params.get(HANDOFF_NONCE);
  if (!nonce || waitsForInput(handoff)) {
    return HandoffStart.Prefill;
  }

  return claim(cookies, nonce) ? HandoffStart.Send : HandoffStart.Prefill;
}
