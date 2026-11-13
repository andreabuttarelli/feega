import { z } from 'zod';
import type { BrandEndpoint, EndpointFailure } from './index';

const LinkSchema = z
  .string()
  .describe('One-time Stripe URL. Give it to the account owner and keep no copy');

const PlanSchema = z.object({ credits: z.number(), label: z.string() });

const PortalInputSchema = z.object({}).strict();

const PortalResultSchema = z.object({
  ok: z.literal(true),
  url: LinkSchema
});

const CheckoutInputSchema = z
  .object({
    credits: z
      .number()
      .positive()
      .optional()
      .describe('The one plan: 500 credits a month per editor for €9 (100 credits = €1). Any other amount is refused')
  })
  .strict();

const CheckoutResultSchema = z.object({
  ok: z.literal(true),
  url: LinkSchema,
  plans: z.array(PlanSchema).describe('The plan the hosted page sells')
});

const BILLING_FAILURES: readonly EndpointFailure[] = [
  { error: 'not_org_owner', status: 403 },
  { error: 'no_customer', status: 409 },
  { error: 'no_org_billing', status: 500 },
  { error: 'stripe_unavailable', status: 502 },
  { error: 'purchases_not_ready', status: 409 }
];

export type BillingPortalLinkResult = z.infer<typeof PortalResultSchema>;
export type CheckoutLinkInput = z.infer<typeof CheckoutInputSchema>;
export type CheckoutLinkResult = z.infer<typeof CheckoutResultSchema>;

export const BILLING_PORTAL_LINK = {
  tool: 'create_billing_portal_link',
  title: 'Billing portal link',
  description:
    'Mint a one-time link to this organization\'s Stripe billing portal and hand it to the account ' +
    'owner. On that page THEY can read invoices, change the card and CANCEL the ' +
    'subscription — you never open it and never act inside it. Treat the URL as a credential: ' +
    'whoever holds it reaches that customer\'s billing, so give it to the owner once, in the ' +
    'reply, and never store or repeat it. Only the organization owner can mint one. Free: it ' +
    'works precisely when credits are gone.',
  method: 'POST',
  pathUnderBrand: '/billing/portal',
  input: PortalInputSchema,
  output: PortalResultSchema,
  failures: BILLING_FAILURES,
  destructive: false
} satisfies BrandEndpoint;

export const CHECKOUT_LINK = {
  tool: 'create_checkout_link',
  title: 'Checkout link',
  description:
    'Mint a one-time link where the human subscribes to feega\'s one plan (€9 per editor a month, ' +
    '500 credits per editor, credits never expire) and pays, on Stripe\'s own hosted page. You ' +
    'never pay and never apply a discount: you return the URL, they complete it. Treat the URL as ' +
    'the owner credential and hand it over once, never stored, never repeated. Only the ' +
    'organization owner can mint one. Free: it works precisely when credits are gone. An ' +
    'organization that already subscribes is refused with already_subscribed and app_billing_url, ' +
    'where the human manages the plan and buys top-ups. To cancel, the owner uses the billing ' +
    'portal link, never this one.',
  method: 'POST',
  pathUnderBrand: '/billing/checkout',
  input: CheckoutInputSchema,
  output: CheckoutResultSchema,
  failures: [
    ...BILLING_FAILURES,
    { error: 'unknown_plan', status: 400 },
    { error: 'already_subscribed', status: 409 },
    { error: 'subscriptions_not_configured', status: 409 }
  ],
  destructive: false
} satisfies BrandEndpoint;

const OneTimeCheckoutInputSchema = z
  .object({
    credits: z
      .number()
      .positive()
      .describe('One-time top-up in credits: 1000 (€10), 2000 (€20) or 5000 (€50). Any other amount is refused')
  })
  .strict();

const OneTimeCheckoutResultSchema = z.object({
  ok: z.literal(true),
  url: LinkSchema,
  credits: z.number().describe('Credits this purchase grants. Never expires.')
});

export type OneTimeCheckoutLinkInput = z.infer<typeof OneTimeCheckoutInputSchema>;
export type OneTimeCheckoutLinkResult = z.infer<typeof OneTimeCheckoutResultSchema>;

export const ONE_TIME_CHECKOUT_LINK = {
  tool: 'create_one_time_checkout_link',
  title: 'One-time credit purchase link',
  description:
    'Mint a one-time link where the human buys a fixed batch of credits once, on Stripe\'s own ' +
    'hosted page — never a subscription. You never pay, never change a plan and never cancel ' +
    'anything: you return the URL, they complete it. These credits never expire. Only the ' +
    'organization owner can mint one. An organization with no Stripe customer yet gets one ' +
    'created on the spot — unlike the subscription link, there is nothing to check out AGAINST ' +
    'first.',
  method: 'POST',
  pathUnderBrand: '/billing/checkout/one-time',
  input: OneTimeCheckoutInputSchema,
  output: OneTimeCheckoutResultSchema,
  failures: [
    { error: 'not_org_owner', status: 403 },
    { error: 'no_org_billing', status: 500 },
    { error: 'stripe_unavailable', status: 502 },
    { error: 'unknown_plan', status: 400 },
    { error: 'purchases_not_ready', status: 409 }
  ],
  destructive: false
} satisfies BrandEndpoint;
