import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AgeVerifier } from './age-verification';

const API = 'https://verification.didit.me/v3';
const REPLAY_WINDOW_SECONDS = 300;
const HTTP_NOT_FOUND = 404;
export const DIDIT_PROVIDER = 'didit';

export type DiditConfig = { apiKey: string; webhookSecret: string; workflowId: string };

export type DiditDeps = { fetch: typeof fetch; now: () => number };

export enum AgeVerdict {
  Adult = 'adult',
  Refused = 'refused',
  Pending = 'pending'
}

export type DiditResult = { verdict: AgeVerdict; userId: string; sessionId: string };

const VERDICT_OF_STATUS: Readonly<Record<string, AgeVerdict>> = {
  Approved: AgeVerdict.Adult,
  Declined: AgeVerdict.Refused,
  Abandoned: AgeVerdict.Refused,
  Expired: AgeVerdict.Refused,
  'Kyc Expired': AgeVerdict.Refused
};

export type Didit = AgeVerifier & {
  decision(sessionId: string): Promise<DiditResult | null>;
  readWebhook(rawBody: string, headers: Headers): DiditResult | null;
  forget(sessionId: string): Promise<void>;
};

export function diditFromEnv(env: Record<string, string | undefined>): DiditConfig | null {
  const apiKey = env.DIDIT_API_KEY;
  const webhookSecret = env.DIDIT_WEBHOOK_SECRET;
  const workflowId = env.DIDIT_WORKFLOW_ID;
  if (!apiKey || !webhookSecret || !workflowId) {
    return null;
  }
  return { apiKey, webhookSecret, workflowId };
}

function resultOf(body: { session_id?: unknown; status?: unknown; vendor_data?: unknown }): DiditResult | null {
  if (typeof body.session_id !== 'string' || typeof body.vendor_data !== 'string' || typeof body.status !== 'string') {
    return null;
  }
  return { verdict: VERDICT_OF_STATUS[body.status] ?? AgeVerdict.Pending, userId: body.vendor_data, sessionId: body.session_id };
}

function sameDigest(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parsed(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function diditVerifier(config: DiditConfig, deps: DiditDeps): Didit {
  const headers = { 'x-api-key': config.apiKey, 'content-type': 'application/json' };

  return {
    key: DIDIT_PROVIDER,

    async start(userId, returnUrl) {
      const res = await deps.fetch(`${API}/session/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ workflow_id: config.workflowId, vendor_data: userId, callback: returnUrl })
      });
      const body = (await res.json().catch(() => ({}))) as { url?: unknown };
      if (!res.ok || typeof body.url !== 'string') {
        throw new Error('didit_session_failed');
      }
      return { redirect: body.url };
    },

    async decision(sessionId) {
      const res = await deps.fetch(`${API}/session/${encodeURIComponent(sessionId)}/decision/`, { headers });
      if (!res.ok) {
        return null;
      }
      return resultOf(await res.json());
    },

    readWebhook(rawBody, given) {
      const signature = given.get('x-signature') ?? '';
      const sentAt = Number(given.get('x-timestamp'));
      if (!Number.isFinite(sentAt) || Math.abs(deps.now() - sentAt) > REPLAY_WINDOW_SECONDS) {
        return null;
      }
      if (!sameDigest(createHmac('sha256', config.webhookSecret).update(rawBody).digest('hex'), signature)) {
        return null;
      }
      const body = parsed(rawBody);
      return body ? resultOf(body) : null;
    },

    async forget(sessionId) {
      const res = await deps.fetch(`${API}/session/${encodeURIComponent(sessionId)}/delete/`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ retain_face_embeddings: false, deletion_instruction: 'privacy_erasure' })
      });
      if (!res.ok && res.status !== HTTP_NOT_FOUND) {
        throw new Error(`didit_delete_failed_${res.status}`);
      }
    }
  };
}
