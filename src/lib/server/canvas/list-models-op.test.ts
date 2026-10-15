import { describe, expect, it, vi } from 'vitest';
import type { ModelChoice } from '$lib/canvas/gen-node';
import { ProjectMode } from '$lib/project-mode';

const choices: ModelChoice[] = [
  { id: 'nano-banana-2', label: 'Nano Banana 2', aspectRatios: ['1:1'], provider: 'google', providerLabel: 'Google', unitCredits: 8, discountRoute: { provider: 'kie', label: 'Kie.ai' }, routes: [{ provider: 'auto', label: 'Auto (cheapest healthy)', price: { unitCredits: 8 }, stats: null }, { provider: 'openrouter', label: 'OpenRouter', price: { unitCredits: 10 }, stats: null }, { provider: 'kie', label: 'Kie.ai', price: { unitCredits: 8 }, stats: { successRate: 1, p95Ms: 9000, healthy: true } }] },
  { id: 'wiro/wiro-partners/z-image-uncensored', label: 'Z Image', aspectRatios: ['1:1'], provider: 'wiro', providerLabel: 'Wiro', uncensored: true, pricedInputs: [{ inputs: {}, credits: 3 }] },
  { id: 'higgsfield/higgsfield-ai/soul/standard', label: 'Higgsfield Soul', aspectRatios: ['1:1'], provider: 'higgsfield', providerLabel: 'Higgsfield', variableCredits: true }
];

const mode = vi.hoisted(() => ({ current: 'standard' }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ projectModeOf: async () => mode.current }));
vi.mock('$lib/server/canvas-catalogue', () => ({
  canvasModelCatalogue: async () => ({ image: { choices, recommended: [] }, text: { choices: [] }, video: { choices: [] }, audio: { choices: [] }, model3d: { choices: [] } })
}));
vi.mock('$lib/server/uncensored-access', () => ({
  NO_UNCENSORED_ACCESS: { allowed: false },
  uncensoredAccess: async () => ({ allowed: true }),
  visibleCatalogue: <T>(catalogue: T) => catalogue
}));

const { CANVAS_OPS } = await import('./canvas-ops');
const ctx = { db: {}, orgId: 'o', projectId: 'p', userId: 'u' } as never;

describe('list_models — the catalogue the picker shows, for the chat and MCP', () => {
  it('lists provider, credits and the cheaper route, and hides uncensored models in a standard project', async () => {
    mode.current = ProjectMode.Standard;

    const out = (await CANVAS_OPS.list_models.run(ctx, { medium: 'image' })) as { models: Array<Record<string, unknown>> };

    expect(out.models).toEqual([
      expect.objectContaining({ id: 'nano-banana-2', provider: 'Google', credits: 8, routedVia: 'Kie.ai', uncensored: false }),
      expect.objectContaining({ id: 'higgsfield/higgsfield-ai/soul/standard', provider: 'Higgsfield', credits: null, variableCredits: true })
    ]);
  });

  it('lists every provider that serves a model, with its own price, so an agent can pick one for run_node', async () => {
    mode.current = ProjectMode.Standard;

    const out = (await CANVAS_OPS.list_models.run(ctx, { medium: 'image' })) as { models: Array<{ id: string; routes: unknown[] }> };

    expect(out.models.find((m) => m.id === 'nano-banana-2')?.routes).toEqual([
      { provider: 'auto', label: 'Auto (cheapest healthy)', credits: 8, healthy: null },
      { provider: 'openrouter', label: 'OpenRouter', credits: 10, healthy: null },
      { provider: 'kie', label: 'Kie.ai', credits: 8, healthy: true }
    ]);
  });

  it('shows uncensored models, flagged, in an uncensored project', async () => {
    mode.current = ProjectMode.Uncensored;

    const out = (await CANVAS_OPS.list_models.run(ctx, { medium: 'image' })) as { models: Array<Record<string, unknown>> };

    expect(out.models).toContainEqual(expect.objectContaining({ id: 'wiro/wiro-partners/z-image-uncensored', uncensored: true, credits: 3 }));
  });
});
