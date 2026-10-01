import { describe, expect, it, vi } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { seedWelcome, WELCOME_ORIGIN, type WelcomeDeps } from './welcome';

const db = {} as Db;
const place = { userId: 'u1', orgId: 'o1', projectId: 'p1', canvasId: 'c1' };

function deps(over: Partial<Record<keyof WelcomeDeps, unknown>> = {}) {
  return {
    listNodes: vi.fn(async () => []),
    claimCampaign: vi.fn(async () => true),
    insertTemplate: vi.fn(async () => ({ nodes: [], connections: [] })),
    ...over
  } as unknown as WelcomeDeps & Record<keyof WelcomeDeps, ReturnType<typeof vi.fn>>;
}

describe('the landing template lands once, on an empty first canvas', () => {
  it('inserts the mapped template, centred on the canvas origin', async () => {
    const d = deps();

    expect(await seedWelcome(db, place, 'anime-video-generator', d)).toBe(true);

    expect(d.claimCampaign).toHaveBeenCalledWith(db, 'u1', 'anime-video-generator');
    expect(d.insertTemplate).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ orgId: 'o1', projectId: 'p1', canvasId: 'c1', templateId: 'anime-video', at: WELCOME_ORIGIN })
    );
  });

  it('a second landing with the same campaign never re-inserts', async () => {
    const d = deps({ claimCampaign: vi.fn(async () => false) });

    expect(await seedWelcome(db, place, 'anime-video-generator', d)).toBe(false);

    expect(d.insertTemplate).not.toHaveBeenCalled();
  });

  it('a canvas with work on it is never touched, and the campaign is not spent', async () => {
    const d = deps({ listNodes: vi.fn(async () => [{ id: 'n1' }]) });

    expect(await seedWelcome(db, place, 'claymation-ai', d)).toBe(false);

    expect(d.claimCampaign).not.toHaveBeenCalled();
    expect(d.insertTemplate).not.toHaveBeenCalled();
  });
});
