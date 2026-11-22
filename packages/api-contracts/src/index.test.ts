import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ORG_ENDPOINTS, pathFor, statusForFailure, type OrgEndpoint } from './index';

const byTool = (tool: string): OrgEndpoint => {
  const found = ORG_ENDPOINTS.find((e) => e.tool === tool);
  if (!found) {
    throw new Error(`missing endpoint ${tool}`);
  }
  return found;
};

const BILLING_TOOLS = ['create_billing_portal_link', 'create_checkout_link', 'create_one_time_checkout_link'];

describe('the org endpoint registry', () => {
  it('describes at least one write, or it proves nothing', () => {
    expect(ORG_ENDPOINTS.some((e) => e.method === 'POST')).toBe(true);
  });

  it('never repeats a tool name', () => {
    const names = ORG_ENDPOINTS.map((e) => e.tool);
    expect(names).toEqual([...new Set(names)]);
  });

  it('every path starts with a slash and carries no brand or slug', () => {
    for (const e of ORG_ENDPOINTS) {
      expect(e.path.startsWith('/'), e.tool).toBe(true);
      expect(e.path.includes('brand'), e.tool).toBe(false);
      expect(e.path.includes(':'), e.tool).toBe(false);
    }
  });

  it('billing paths live under the org', () => {
    expect(pathFor(byTool('create_billing_portal_link'))).toBe('/api/v1/org/billing/portal');
    expect(pathFor(byTool('create_checkout_link'))).toBe('/api/v1/org/billing/checkout');
    expect(pathFor(byTool('create_one_time_checkout_link'))).toBe('/api/v1/org/billing/checkout/one-time');
  });

  it('a read is never destructive', () => {
    for (const e of ORG_ENDPOINTS.filter((e) => e.method === 'GET')) {
      expect(e.destructive, e.tool).toBe(false);
    }
  });

  it('every declared failure has a unique name and a client or server status', () => {
    for (const e of ORG_ENDPOINTS) {
      const names = e.failures.map((f) => f.error);
      expect(names, e.tool).toEqual([...new Set(names)]);
      for (const f of e.failures) {
        expect(f.status, `${e.tool}/${f.error}`).toBeGreaterThanOrEqual(400);
        expect(f.status, `${e.tool}/${f.error}`).toBeLessThan(600);
      }
    }
  });

  it('an undeclared failure is a 500, not a silent 400', () => {
    expect(statusForFailure(byTool('create_checkout_link'), 'never_declared')).toBe(500);
  });

  it('a field no endpoint declares is rejected, not dropped', () => {
    for (const e of ORG_ENDPOINTS) {
      expect(e.input.safeParse({ campo_che_non_esiste: 'x' }).success, e.tool).toBe(false);
    }
  });

  it('billing links hit Stripe and are not destructive', () => {
    for (const tool of BILLING_TOOLS) {
      const e = byTool(tool);
      expect(e.method, tool).toBe('POST');
      expect(e.destructive, tool).toBe(false);
    }
  });

  it('the link descriptions say cancelling is possible and that a human opens the link', () => {
    for (const tool of ['create_billing_portal_link', 'create_checkout_link']) {
      const { description } = byTool(tool);
      expect(description.toLowerCase(), tool).toContain('cancel');
      expect(description.toLowerCase(), tool).toContain('never');
    }
  });

  it('a Stripe outage is ours: 502, not a 4xx accusing the caller', () => {
    for (const tool of BILLING_TOOLS) {
      expect(statusForFailure(byTool(tool), 'stripe_unavailable'), tool).toBe(502);
      expect(statusForFailure(byTool(tool), 'no_org_billing'), tool).toBe(500);
    }
  });

  it('a non-owner of the org gets 403', () => {
    for (const tool of BILLING_TOOLS) {
      expect(statusForFailure(byTool(tool), 'not_org_owner'), tool).toBe(403);
    }
  });

  it('an org without a Stripe customer is a conflict, not a syntax error: 409', () => {
    expect(statusForFailure(byTool('create_billing_portal_link'), 'no_customer')).toBe(409);
    expect(statusForFailure(byTool('create_checkout_link'), 'no_customer')).toBe(409);
    expect(statusForFailure(byTool('create_checkout_link'), 'already_subscribed')).toBe(409);
  });

  it('the portal takes no parameters', () => {
    const { input } = byTool('create_billing_portal_link');
    expect(input.safeParse({}).success).toBe(true);
    expect(input.safeParse({ flow: 'cancel' }).success).toBe(false);
  });

  it('the portal promises a url', () => {
    const { output } = byTool('create_billing_portal_link');
    expect(output.safeParse({ ok: true, url: 'https://billing.stripe.com/p/session/live_xyz' }).success).toBe(true);
    expect(output.safeParse({ ok: true }).success).toBe(false);
  });

  it('a response with an outputSchema is an object: MCP cannot carry an array', () => {
    for (const e of ORG_ENDPOINTS) {
      if (!(e.output instanceof z.ZodObject)) {
        continue;
      }
      expect(e.output.safeParse([]).success, e.tool).toBe(false);
    }
  });
});
