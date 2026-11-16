import { beforeEach, describe, expect, it, vi } from 'vitest';

const aiCallsRows: Record<string, unknown>[] = [];
const ledgerRows: Record<string, unknown>[] = [];
const failures = { next: 0, code: undefined as string | undefined };
const swallowed: string[] = [];

vi.mock('./swallow', () => ({ swallow: (reason: string) => void swallowed.push(reason) }));

vi.mock('./supabase-admin', () => ({
	createAdminClient: () => ({
		from: (table: string) => {
			if (table === 'ai_calls') {
				return {
					insert: (row: Record<string, unknown>) => ({
						select: () => ({
							single: async () => {
								if (failures.next > 0) {
									failures.next -= 1;
									return { data: null, error: { message: 'connection reset', code: failures.code } };
								}
								if (aiCallsRows.some((r) => r.id === row.id)) {
									return { data: null, error: { message: 'duplicate key value violates unique constraint "ai_calls_pkey"', code: '23505' } };
								}
								aiCallsRows.push(row);
								const credits = Number(row.billed_credits ?? 0);
								if (credits > 0) ledgerRows.push({ org_id: row.org_id, kind: 'debit', source: 'ai_usage', amount: Math.ceil(credits), ai_call_id: row.id });
								return { data: { id: row.id }, error: null };
							}
						})
					})
				};
			}
			throw new Error(`the app writes ${table} itself: the debit belongs to the ai_calls insert`);
		}
	})
}));

import { logAiCall, withBrandContext } from './ai-log';
import { CHAT_MULTIPLIER, CREDITS_PER_USD_GRANT } from '$lib/credit-ladder';
import { RENDER_CALL_LABEL, RENDER_MULTIPLIER } from '$lib/motion/render-quote';
import { GEMINI_FLASH } from './google-models';

async function settled(): Promise<void> {
	await vi.waitFor(() => expect(aiCallsRows.length).toBeGreaterThan(0));
	await vi.waitFor(() => expect(ledgerRows.length).toBeGreaterThan(0));
}

beforeEach(() => {
	aiCallsRows.length = 0;
	ledgerRows.length = 0;
	swallowed.length = 0;
	failures.next = 0;
	failures.code = undefined;
});

describe('a usage row is written until it lands, once', () => {
	it('carries its own id, so the database can tell a retry from a second call', async () => {
		logAiCall({ label: 'chat', provider: 'llm', ms: 5, ok: true, flatCostUsd: 0.01, orgId: 'org-1' });

		await settled();
		expect(aiCallsRows[0].id).toMatch(/^[0-9a-f-]{36}$/);
	});

	it('a failed insert is retried with the same id until it lands', async () => {
		failures.next = 2;
		logAiCall({ label: 'chat', provider: 'llm', ms: 5, ok: true, flatCostUsd: 0.01, orgId: 'org-1' });

		await vi.waitFor(() => expect(aiCallsRows).toHaveLength(1), { timeout: 5000 });
		expect(ledgerRows).toHaveLength(1);
		expect(swallowed).toEqual([]);
	});

	it('a row that never lands is reported, with the credits it leaves unbilled', async () => {
		failures.next = 99;
		logAiCall({ label: 'chat', provider: 'llm', ms: 5, ok: true, flatCostUsd: 0.01, orgId: 'org-1' });

		await vi.waitFor(() => expect(swallowed).toHaveLength(1), { timeout: 5000 });
		expect(swallowed[0]).toMatch(/unbilled/);
		expect(aiCallsRows).toHaveLength(0);
	});

	it('a retry answered "already there" counts as landed, not as a second charge', async () => {
		failures.next = 1;
		failures.code = '23505';
		logAiCall({ label: 'chat', provider: 'llm', ms: 5, ok: true, flatCostUsd: 0.01, orgId: 'org-1' });

		await new Promise((r) => setTimeout(r, 50));
		expect(swallowed).toEqual([]);
		expect(ledgerRows.length).toBeLessThanOrEqual(1);
	});

	it('a row with no org to bill is reported, not dropped in silence', async () => {
		logAiCall({ label: 'chat', provider: 'llm', ms: 5, ok: true, flatCostUsd: 0.01 });

		await vi.waitFor(() => expect(swallowed).toHaveLength(1));
		expect(swallowed[0]).toMatch(/no org/);
	});

	it('a render settles the hold it names', async () => {
		logAiCall({ label: RENDER_CALL_LABEL, provider: 'vercel-sandbox', ms: 900, ok: true, flatCostUsd: 0.02, orgId: 'org-1', creditCap: 1000, holdKey: 'motion render hold r1' });

		await settled();
		expect(aiCallsRows[0].hold_key).toBe('motion render hold r1');
	});
});

describe('a priced call is debited by its own row', () => {
	it('the debit hangs off the row, on the row\'s org', async () => {
		withBrandContext('brand-1', () => {
			logAiCall({
				label: 'renderImage',
				provider: 'llm',
				model: GEMINI_FLASH,
				ms: 842,
				ok: true,
				inputTokens: 1_000_000,
				outputTokens: 1_000_000,
				orgId: 'org-1'
			});
		});

		await settled();

		expect(ledgerRows).toHaveLength(1);
		const debit = ledgerRows[0];
		expect(debit.org_id).toBe('org-1');
		expect(debit.kind).toBe('debit');
		expect(debit.source).toBe('ai_usage');
		expect(debit.ai_call_id).toBe(aiCallsRows[0].id);
		expect(debit.amount).toBeGreaterThan(0);
	});

	it('non debita una riga senza prezzo (cost_usd null)', async () => {
		withBrandContext('brand-1', () => {
			logAiCall({ label: 'internal_event', provider: 'internal', ms: 1, ok: true, orgId: 'org-1' });
		});

		await vi.waitFor(() => expect(aiCallsRows.length).toBeGreaterThan(0));
		expect(ledgerRows).toHaveLength(0);
	});

	it('non debita una chiamata fallita', async () => {
		withBrandContext('brand-1', () => {
			logAiCall({ label: 'chat', provider: 'llm', ms: 5, ok: false, error: 'boom', orgId: 'org-1' });
		});

		await vi.waitFor(() => expect(aiCallsRows.length).toBeGreaterThan(0));
		expect(ledgerRows).toHaveLength(0);
	});

	it.each(['moderation.judge', 'moderation.jev', 'moderation.judge.identifiability'])('%s: logs the cost but bills the user nothing', async (label) => {
		logAiCall({ label, provider: 'jev', ms: 90, ok: true, flatCostUsd: 0.002, orgId: 'org-1' });

		await vi.waitFor(() => expect(aiCallsRows.length).toBeGreaterThan(0));
		await new Promise((r) => setTimeout(r, 10));
		expect(aiCallsRows[0].cost_usd).toBe(0.002);
		expect(aiCallsRows[0].billed_credits).toBeNull();
		expect(ledgerRows).toHaveLength(0);
	});
});

describe('what a credit costs the user against what the call cost us', () => {
	it('a chat turn of an agent bills 1.2 times its cost', async () => {
		logAiCall({ label: 'project-agent', provider: 'llm', ms: 900, ok: true, flatCostUsd: 0.05, orgId: 'org-1', actorKind: 'agent', threadId: 't1', agentKey: 'sidebar' });

		await settled();

		expect(ledgerRows[0].amount).toBe(Math.round(0.05 * CHAT_MULTIPLIER * CREDITS_PER_USD_GRANT));
	});

	it('a chat turn costing one dollar bills 120 credits', async () => {
		logAiCall({ label: 'project-agent', provider: 'llm', ms: 900, ok: true, flatCostUsd: 1, orgId: 'org-1', actorKind: 'agent', threadId: 't1', agentKey: 'sidebar' });

		await settled();

		expect(ledgerRows[0].amount).toBe(120);
	});

	it('a render bills its measured sandbox cost times the render multiplier', async () => {
		logAiCall({ label: RENDER_CALL_LABEL, provider: 'vercel-sandbox', ms: 900, ok: true, flatCostUsd: 0.02, orgId: 'org-1', creditCap: 1000 });

		await settled();

		expect(ledgerRows[0].amount).toBe(Math.round(0.02 * RENDER_MULTIPLIER * CREDITS_PER_USD_GRANT));
	});

	it('a render never bills past the credits held for it', async () => {
		logAiCall({ label: RENDER_CALL_LABEL, provider: 'vercel-sandbox', ms: 900, ok: true, flatCostUsd: 1, orgId: 'org-1', creditCap: 9 });

		await settled();

		expect(ledgerRows[0].amount).toBe(9);
		expect(aiCallsRows[0].billed_credits).toBe(9);
	});
});
