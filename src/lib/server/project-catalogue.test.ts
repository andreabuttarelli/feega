import { beforeEach, describe, expect, it, vi } from 'vitest';

const canvasModelCatalogue = vi.fn();

vi.mock('$lib/server/canvas-catalogue', () => ({ canvasModelCatalogue: () => canvasModelCatalogue() }));
vi.mock('$lib/server/uncensored-access', async (importOriginal) => ({ ...(await importOriginal<object>()), uncensoredAccess: async () => ({ allowed: false, reason: 'plan_not_entitled', entitled: false, optIn: null }) }));

const EMPTY = { text: { choices: [] }, image: { choices: [] }, video: { choices: [] }, model3d: { choices: [] } };

beforeEach(() => {
  vi.resetModules();
  vi.useRealTimers();
  canvasModelCatalogue.mockReset();
  canvasModelCatalogue.mockResolvedValue(EMPTY);
});

describe('the catalogue a canvas page lists', () => {
  it('reads the model tables once per minute, not on every canvas open', async () => {
    const { projectCatalogue } = await import('./project-catalogue');

    await projectCatalogue({} as never, { orgId: 'org-1', mode: 'standard' as never });
    await projectCatalogue({} as never, { orgId: 'org-2', mode: 'standard' as never });

    expect(canvasModelCatalogue).toHaveBeenCalledTimes(1);
  });

  it('reads them again once the minute has passed', async () => {
    vi.useFakeTimers();
    const { projectCatalogue } = await import('./project-catalogue');

    await projectCatalogue({} as never, { orgId: 'org-1', mode: 'standard' as never });
    vi.advanceTimersByTime(61_000);
    await projectCatalogue({} as never, { orgId: 'org-1', mode: 'standard' as never });

    expect(canvasModelCatalogue).toHaveBeenCalledTimes(2);
  });
});
