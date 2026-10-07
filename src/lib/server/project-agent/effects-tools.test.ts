import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { fakeDb } from '$lib/server/db/fake-db';

const actions = vi.hoisted(() => ({ applyEffectsTo: vi.fn(), makeEffectsPair: vi.fn() }));
vi.mock('$lib/server/canvas/effects-actions', () => actions);

import { createProjectTools } from './project-tools';
import { EFFECTS } from '$lib/canvas/effects';

const USER = 'user-1';
const run = (t: Tool, args: unknown) =>
  (t.execute as (a: unknown, o: unknown) => Promise<Record<string, unknown>>)(args, { toolCallId: 't1', messages: [] });

function tools() {
  const { db } = fakeDb({});
  return { db, tools: createProjectTools({ db, orgId: 'org-1', projectId: 'p-1', userId: USER }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  actions.applyEffectsTo.mockResolvedValue({ outcome: 'applied', nodeId: 'fx-1', assetId: 'asset-1' });
  actions.makeEffectsPair.mockResolvedValue({ outcome: 'applied', nodeId: 'fx-2', assetId: 'asset-2' });
});

describe('gli effetti dalla chat della tela', () => {
  it('list_effects rende la tabella EFFECTS, con i parametri', async () => {
    const out = await run(tools().tools.list_effects, {});

    expect((out.effects as { id: string }[]).map((e) => e.id).sort()).toEqual(Object.keys(EFFECTS).sort());
  });

  it('apply_effects passa nodo e catena allo stesso percorso di MCP, firmato agent', async () => {
    const { db, tools: t } = tools();
    const effects = [{ id: 'posterize', params: { levels: 3 } }];

    const out = await run(t.apply_effects, { nodeId: 'image-1', effects });

    expect(actions.applyEffectsTo).toHaveBeenCalledWith(db, expect.objectContaining({ orgId: 'org-1', nodeId: 'image-1', effects, actor: expect.objectContaining({ kind: 'agent', id: USER }) }));
    expect(out).toEqual({ outcome: 'applied', nodeId: 'fx-1', assetId: 'asset-1' });
  });

  it('make_effects_pair crea il gemello A/B', async () => {
    const out = await run(tools().tools.make_effects_pair, { nodeId: 'fx-1' });

    expect(actions.makeEffectsPair).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ nodeId: 'fx-1' }));
    expect(out.nodeId).toBe('fx-2');
  });
});
