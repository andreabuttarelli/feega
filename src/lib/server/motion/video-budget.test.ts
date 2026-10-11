import { describe, expect, it, vi } from 'vitest';
import { AGENT_TURN_CAP_USD, VIDEO_CAP_USD, VIDEO_RAISE_USD } from '$lib/server/brand-agent/limits';

const nodes = vi.hoisted(() => ({ data: {} as Record<string, unknown>, patches: [] as { patch: Record<string, unknown>; base?: Record<string, unknown> }[] }));

vi.mock('$lib/server/repos/canvas', () => ({
  DataCheck: { Schema: 'schema', None: 'none' },
  findNode: async () => ({ id: 'n-1', type: 'motion', data: nodes.data }),
  patchNodeData: async (_db: unknown, input: { patch: Record<string, unknown>; base?: Record<string, unknown> }) => {
    nodes.patches.push(input);
    nodes.data = { ...nodes.data, ...input.patch };
    return { outcome: 'written', node: { id: 'n-1', type: 'motion', data: nodes.data } };
  }
}));

const { budgetCard, budgetSpent, raiseVideoBudget, readVideoBudget, turnBudgetUsd, videoBudget } = await import('./video-budget');

function rowsDb(rows: { cost_usd: number | null }[], seen: string[][] = []) {
  const chain = {
    select: () => chain,
    eq: (col: string, value: string) => (seen.push([col, value]), chain),
    then: (ok: (r: { data: unknown; error: null }) => unknown) => ok({ data: rows, error: null })
  };
  return { from: (table: string) => (seen.push(['from', table]), chain) } as never;
}

describe('a motion video has one budget across all its turns', () => {
  it('a fresh video gives a turn its usual cap', () => {
    expect(turnBudgetUsd(videoBudget(0, 0))).toBe(AGENT_TURN_CAP_USD);
  });

  it('a turn gets only what is left of the video, never a fresh cap (eval: linear spent $6.33 in five turns)', () => {
    expect(turnBudgetUsd(videoBudget(VIDEO_CAP_USD - 0.3, 0))).toBeCloseTo(0.3);
    expect(turnBudgetUsd(videoBudget(VIDEO_CAP_USD + 1, 0))).toBe(0);
  });

  it('what the user added on top is spendable', () => {
    expect(turnBudgetUsd(videoBudget(VIDEO_CAP_USD, VIDEO_RAISE_USD))).toBe(Math.min(AGENT_TURN_CAP_USD, VIDEO_RAISE_USD));
  });

  it('is spent when what is left would not pay for a step', () => {
    expect(budgetSpent(videoBudget(VIDEO_CAP_USD - 0.01, 0))).toBe(true);
    expect(budgetSpent(videoBudget(1, 0))).toBe(false);
  });

  it('the card tells the cost so far and what continuing adds', () => {
    expect(budgetCard(videoBudget(2.04, 0))).toEqual({ ok: true, spent_usd: 2.04, cap_usd: VIDEO_CAP_USD, raise_usd: VIDEO_RAISE_USD });
  });

  it('the spend is the sum of every ai_calls row of the node, whoever made it', async () => {
    const seen: string[][] = [];
    const budget = await readVideoBudget(rowsDb([{ cost_usd: 0.5 }, { cost_usd: null }, { cost_usd: 1.25 }], seen), { orgId: 'o-1', nodeId: 'n-1' }, 0);

    expect(budget.spentUsd).toBeCloseTo(1.75);
    expect(seen).toContainEqual(['from', 'ai_calls']);
    expect(seen).toContainEqual(['node_id', 'n-1']);
    expect(seen).toContainEqual(['org_id', 'o-1']);
  });

  it('a raise is kept on the node and adds up, guarded against a concurrent raise', async () => {
    nodes.data = { format: 'vertical', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null };
    const db = rowsDb([{ cost_usd: 2.1 }]);

    await raiseVideoBudget(db, { orgId: 'o-1', nodeId: 'n-1' });
    const raised = await raiseVideoBudget(db, { orgId: 'o-1', nodeId: 'n-1' });

    expect(nodes.data.budgetRaisedUsd).toBe(2 * VIDEO_RAISE_USD);
    expect(nodes.patches[1].base).toEqual({ budgetRaisedUsd: VIDEO_RAISE_USD });
    expect(raised).toEqual({ spentUsd: 2.1, capUsd: VIDEO_CAP_USD + 2 * VIDEO_RAISE_USD });
  });
});
