import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `logAiCall` scriveva `ai_calls.cost_usd` e non toccava mai `credit_ledger`: un'org che aveva
 * COMPRATO crediti restava misurata contro `ai_calls` sommato, mai contro il saldo che aveva
 * pagato — un debito mai scritto, quindi un consumo mai visto dal saldo. Qui si prova che un
 * insert riuscito e prezzato scrive ANCHE un debito, agganciato alla riga con `ai_call_id`.
 */

const aiCallsRows: Record<string, unknown>[] = [];
const ledgerRows: Record<string, unknown>[] = [];

vi.mock('./supabase-admin', () => ({
	createAdminClient: () => ({
		from: (table: string) => {
			if (table === 'ai_calls') {
				return {
					insert: (row: Record<string, unknown>) => ({
						select: () => ({
							single: async () => {
								const id = `call-${aiCallsRows.length + 1}`;
								aiCallsRows.push({ ...row, id });
								return { data: { id }, error: null };
							}
						})
					})
				};
			}
			if (table === 'credit_ledger') {
				return {
					insert: async (row: Record<string, unknown>) => {
						ledgerRows.push(row);
						return { error: null };
					}
				};
			}
			throw new Error(`unexpected table ${table}`);
		}
	})
}));

import { logAiCall, withBrandContext } from './ai-log';
import { CHAT_MULTIPLIER, CREDITS_PER_USD_GRANT, MULTIPLIER_FLOOR } from '$lib/credit-ladder';
import { RENDER_CALL_LABEL, RENDER_MULTIPLIER } from '$lib/motion/render-quote';
import { GEMINI_FLASH } from './google-models';

async function settled(): Promise<void> {
	await vi.waitFor(() => expect(aiCallsRows.length).toBeGreaterThan(0));
	await vi.waitFor(() => expect(ledgerRows.length).toBeGreaterThan(0));
}

beforeEach(() => {
	aiCallsRows.length = 0;
	ledgerRows.length = 0;
});

describe('logAiCall debita credit_ledger per una chiamata prezzata', () => {
	it('scrive un debit agganciato con ai_call_id, sull\'org della riga', async () => {
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
	it('a chat turn of an agent bills its cost at least four times over', async () => {
		logAiCall({ label: 'project-agent', provider: 'llm', ms: 900, ok: true, flatCostUsd: 0.05, orgId: 'org-1', actorKind: 'agent', threadId: 't1', agentKey: 'sidebar' });

		await settled();

		expect(CHAT_MULTIPLIER).toBeGreaterThanOrEqual(MULTIPLIER_FLOOR);
		expect(ledgerRows[0].amount).toBe(Math.round(0.05 * CHAT_MULTIPLIER * CREDITS_PER_USD_GRANT));
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
