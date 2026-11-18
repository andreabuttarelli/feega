import type { z } from 'zod';
import { BILLING_PORTAL_LINK, CHECKOUT_LINK, ONE_TIME_CHECKOUT_LINK } from './billing';
import { QUERY_DATABASE } from './query';
import { INSERT_ROW, UPDATE_ROW, DELETE_ROW } from './write';
import { ENHANCE_PROMPT } from './prompts';

export type EndpointFailure = { readonly error: string; readonly status: number };

/**
 * L'intestazione con cui un client dice QUALE tool sta chiamando. `ai_calls` registra la chiamata
 * al modello, non chi l'ha causata: senza questo nome la spesa di un tool non è separabile da
 * quella di nessun altro, e «questo tool vale quello che costa» resta senza risposta.
 */
export const TOOL_HEADER = 'x-feega-tool';
export const TOOL_HEADER_LEGACY = 'x-dazero-tool';

/**
 * Il nome arriva dalla rete, quindi non è un nome finché non lo si guarda: si accetta solo la
 * forma che un tool ha davvero e si scarta il resto invece di scriverlo.
 */
export function toolFromHeader(value: string | null | undefined): string | null {
  return value && /^[a-z][a-z0-9_]{0,63}$/.test(value) ? value : null;
}

export const SESSION_HEADER = 'x-feega-session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sessionFromHeader(value: string | null | undefined): string | null {
  return value && UUID.test(value) ? value : null;
}

type EndpointShape = {
  readonly tool: string;
  readonly title: string;
  readonly description: string;
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly input: z.ZodObject<z.ZodRawShape>;
  readonly output: z.ZodType;
  readonly failures: readonly EndpointFailure[];
  readonly destructive: boolean;
  readonly openWorld?: boolean;
};

export type OrgEndpoint = EndpointShape & {
  readonly path: string;
};

export const ORG_ENDPOINTS: readonly OrgEndpoint[] = [
  BILLING_PORTAL_LINK,
  CHECKOUT_LINK,
  ONE_TIME_CHECKOUT_LINK,
  ENHANCE_PROMPT,
  DELETE_ROW,
  INSERT_ROW,
  QUERY_DATABASE,
  UPDATE_ROW,
];

export function pathFor(endpoint: OrgEndpoint): string {
  return `/api/v1${endpoint.path}`;
}

export function statusForFailure(
  endpoint: { readonly failures: readonly EndpointFailure[] },
  error: string
): number {
  return endpoint.failures.find((f) => f.error === error)?.status ?? 500;
}

export { QUERY_DATABASE, QUERY_OPS, QUERY_TABLE_NAMES, QUERY_DEFAULT_ROWS, QUERY_MAX_ROWS } from './query';
export { QUERY_TABLES } from './query-tables';
export { ENHANCE_PROMPT } from './prompts';
export {
  AUTOMATION_CADENCES,
  AUTOMATION_JOBS,
  AUTOMATION_STATES
} from './automations';
export type { AutomationJob } from './automations';
export { BILLING_PORTAL_LINK, CHECKOUT_LINK, ONE_TIME_CHECKOUT_LINK };
export type {
  BillingPortalLinkResult,
  CheckoutLinkInput,
  CheckoutLinkResult,
  OneTimeCheckoutLinkInput,
  OneTimeCheckoutLinkResult
} from './billing';
export { INSERT_ROW, UPDATE_ROW, DELETE_ROW, UPDATE_MAX_ROWS, DELETE_MAX_ROWS } from './write';
export { TABLE_CHECKS, WRITABLE_COLUMNS } from './write-rules';
