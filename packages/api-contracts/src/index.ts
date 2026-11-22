import type { z } from 'zod';
import { BILLING_PORTAL_LINK, CHECKOUT_LINK, ONE_TIME_CHECKOUT_LINK } from './billing';

export type EndpointFailure = { readonly error: string; readonly status: number };

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
  ONE_TIME_CHECKOUT_LINK
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

export { BILLING_PORTAL_LINK, CHECKOUT_LINK, ONE_TIME_CHECKOUT_LINK };
export type {
  BillingPortalLinkResult,
  CheckoutLinkInput,
  CheckoutLinkResult,
  OneTimeCheckoutLinkInput,
  OneTimeCheckoutLinkResult
} from './billing';
