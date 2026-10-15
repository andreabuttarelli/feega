import { describe, expect, it, vi } from 'vitest';
import type { ModelChoice } from '$lib/canvas/gen-node';
import { ProjectMode } from '$lib/project-mode';

const choices: ModelChoice[] = [
  { id: 'nano-banana-2', label: 'Nano Banana 2', aspectRatios: ['1:1'], provider: 'google', providerLabel: 'Google', unitCredits: 8, discountRoute: { provider: 'kie', label: 'kie.ai' } },
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
      expect.objectContaining({ id: 'nano-banana-2', provider: 'Google', credits: 8, routedVia: 'kie.ai', uncensored: false }),
      expect.objectContaining({ id: 'higgsfield/higgsfield-ai/soul/standard', provider: 'Higgsfield', credits: null, variableCredits: true })
    ]);
  });

  it('shows uncensored models, flagged, in an uncensored project', async () => {
    mode.current = ProjectMode.Uncensored;

    const out = (await CANVAS_OPS.list_models.run(ctx, { medium: 'image' })) as { models: Array<Record<string, unknown>> };

    expect(out.models).toContainEqual(expect.objectContaining({ id: 'wiro/wiro-partners/z-image-uncensored', uncensored: true, credits: 3 }));
  });
});
