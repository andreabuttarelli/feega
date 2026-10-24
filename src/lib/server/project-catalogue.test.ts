import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

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

    await projectCatalogue(fakeDb({}).db, { orgId: 'org-1', mode: 'standard' as never });
    await projectCatalogue(fakeDb({}).db, { orgId: 'org-2', mode: 'standard' as never });

    expect(canvasModelCatalogue).toHaveBeenCalledTimes(1);
  });

  it('reads them again once the minute has passed', async () => {
    vi.useFakeTimers();
    const { projectCatalogue } = await import('./project-catalogue');

    await projectCatalogue(fakeDb({}).db, { orgId: 'org-1', mode: 'standard' as never });
    vi.advanceTimersByTime(61_000);
    await projectCatalogue(fakeDb({}).db, { orgId: 'org-1', mode: 'standard' as never });

    expect(canvasModelCatalogue).toHaveBeenCalledTimes(2);
  });

  it('hides the models the org allow-list leaves out, per org', async () => {
    const choice = (id: string) => ({ id, label: id, aspectRatios: [] });
    canvasModelCatalogue.mockResolvedValue({ ...EMPTY, image: { choices: [choice('a'), choice('b')] } });
    const { db } = fakeDb({ org_model_allowlist: [{ org_id: 'org-1', medium: 'image', model_id: 'a' }] }, { filter: true });
    const { projectCatalogue } = await import('./project-catalogue');

    const restricted = await projectCatalogue(db, { orgId: 'org-1', mode: 'standard' as never });
    const open = await projectCatalogue(db, { orgId: 'org-2', mode: 'standard' as never });

    expect(restricted.image.choices.map((c: { id: string }) => c.id)).toEqual(['a']);
    expect(open.image.choices).toHaveLength(2);
  });
});
