import { beforeEach, describe, expect, it, vi } from 'vitest';

const orgBillingById = vi.fn();
const isOrgOwner = vi.fn();
const createBillingPortalSession = vi.fn();
const applyRetentionCoupon = vi.fn();
const cancelSubscriptionAtPeriodEnd = vi.fn();
const ensureSubscriptionCanceled = vi.fn();

vi.mock('$lib/server/cli-auth', () => ({
	openOrg: vi.fn(),
	checkApiKeyWriteAccess: vi.fn(() => undefined)
}));
vi.mock('$lib/server/org-billing', () => ({
	orgBillingById: (...args: unknown[]) => orgBillingById(...args),
	isOrgOwner: (...args: unknown[]) => isOrgOwner(...args)
}));
vi.mock('$lib/server/stripe', () => ({
	createBillingPortalSession: (...args: unknown[]) => createBillingPortalSession(...args),
	applyRetentionCoupon: (...args: unknown[]) => applyRetentionCoupon(...args),
	cancelSubscriptionAtPeriodEnd: (...args: unknown[]) => cancelSubscriptionAtPeriodEnd(...args),
	ensureSubscriptionCanceled: (...args: unknown[]) => ensureSubscriptionCanceled(...args)
}));
vi.mock('$lib/server/app-url', () => ({ appOrigin: () => 'https://feega.test' }));

import { POST } from './+server';
import { openOrg, checkApiKeyWriteAccess } from '$lib/server/cli-auth';

const PORTAL_URL = 'https://billing.stripe.com/p/session/live_xyz';

const ORG_BILLING = {
	orgId: 'org-1',
	customerId: 'cus_org',
	subscriptionId: 'sub_org',
	plan: 'starter'
};

function call(body: unknown = {}) {
	const url = new URL(`https://feega.test/api/v1/org/billing/portal`);
	return (POST as (event: unknown) => Promise<Response>)({
		request: new Request(url, { method: 'POST', body: JSON.stringify(body) }),
		url
	}).then(async (res) => ({ res, body: await res.json().catch(() => null) }));
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(openOrg).mockResolvedValue({
		call: { supabase: {}, user: { id: 'user-1' }, orgId: 'org-1', apiKey: undefined }
	} as never);
	vi.mocked(checkApiKeyWriteAccess).mockReturnValue(undefined);
	isOrgOwner.mockResolvedValue(true);
	orgBillingById.mockResolvedValue(ORG_BILLING);
	createBillingPortalSession.mockResolvedValue(PORTAL_URL);
});

describe('POST /api/v1/org/billing/portal', () => {
	it('hands back the portal url instead of redirecting to it', async () => {
		const { res, body } = await call();

		expect(res.status).toBe(200);
		expect(res.headers.get('location')).toBeNull();
		expect(body).toEqual({ ok: true, url: PORTAL_URL });
	});

	it('opens the portal of the ORG customer, not of anything in the url', async () => {
		await call();

		expect(orgBillingById).toHaveBeenCalledWith(expect.anything(), 'org-1');
		expect(createBillingPortalSession).toHaveBeenCalledWith({
			customerId: 'cus_org',
			returnUrl: 'https://feega.test/app/settings/billing',
			flow: undefined
		});
	});

	it('checks the owner against the org of the caller', async () => {
		await call();

		expect(isOrgOwner).toHaveBeenCalledWith(expect.anything(), 'org-1', 'user-1');
	});

	it('never charges, never changes a plan, never cancels', async () => {
		await call();

		expect(cancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled();
		expect(applyRetentionCoupon).not.toHaveBeenCalled();
		expect(ensureSubscriptionCanceled).not.toHaveBeenCalled();
	});


	it('refuses a caller who does not own the org billing', async () => {
		isOrgOwner.mockResolvedValue(false);

		const { res, body } = await call();

		expect(res.status).toBe(403);
		expect(body.error).toBe('not_org_owner');
		expect(createBillingPortalSession).not.toHaveBeenCalled();
	});

	it('says no_customer, and where the human subscribes, when nobody ever paid', async () => {
		orgBillingById.mockResolvedValue({ ...ORG_BILLING, customerId: null, subscriptionId: null });

		const { res, body } = await call();

		expect(res.status).toBe(409);
		expect(body.error).toBe('no_customer');
		expect(body.app_billing_url).toBe('https://feega.test/app/settings/billing');
		expect(createBillingPortalSession).not.toHaveBeenCalled();
	});

	it('a Stripe outage is ours: 502, not a 4xx that accuses the caller', async () => {
		createBillingPortalSession.mockRejectedValue(new Error('connection error'));

		const { res, body } = await call();

		expect(res.status).toBe(502);
		expect(body.error).toBe('stripe_unavailable');
	});

	it('an org we cannot resolve is ours too: 500, not a 404', async () => {
		orgBillingById.mockResolvedValue(null);

		const { res, body } = await call();

		expect(res.status).toBe(500);
		expect(body.error).toBe('no_org_billing');
	});

	it('rejects a request without authentication', async () => {
		vi.mocked(openOrg).mockResolvedValue({
			error: new Response('Unauthorized', { status: 401 })
		} as never);

		const { res } = await call();

		expect(res.status).toBe(401);
		expect(createBillingPortalSession).not.toHaveBeenCalled();
	});


	it('rejects a read-only API key: this link leads to a cancel button', async () => {
		vi.mocked(checkApiKeyWriteAccess).mockReturnValue(
			new Response(JSON.stringify({ error: 'API key is read-only' }), { status: 403 }) as never
		);

		const { res } = await call();

		expect(res.status).toBe(403);
		expect(createBillingPortalSession).not.toHaveBeenCalled();
	});

	it('rejects a field the contract does not declare instead of ignoring it', async () => {
		const { res, body } = await call({ flow: 'cancel' });

		expect(res.status).toBe(400);
		expect(body.error).toBe('invalid_input');
		expect(createBillingPortalSession).not.toHaveBeenCalled();
	});
});
