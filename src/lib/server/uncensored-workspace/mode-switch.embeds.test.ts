import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectMode } from '$lib/project-mode';
import { UncensoredLock } from '$lib/uncensored-lock';
import type { Db } from '$lib/server/db/client';

const PROJECT = 'p-1';
const VIDEO = '11111111-2222-4333-8444-555555555555';

const state = vi.hoisted(() => ({ published: new Set<string>() }));

vi.mock('./workspace-server', () => ({ uncensoredLockFor: async () => UncensoredLock.Open }));
vi.mock('$lib/server/motion/embed', () => ({
  embedPublished: async (_db: unknown, nodeId: string) => state.published.has(nodeId)
}));

const { switchProjectMode, NOT_SHAREABLE, SWITCH_REFUSAL_TEXT } = await import('./mode-switch');

const MOTION_ROWS = [{ id: VIDEO }];

function projectDb(): Db {
  const chain = (table: string) => {
    let tokenFilter = false;
    let motionFilter = false;
    const self = {
      select: () => self,
      update: () => self,
      eq: (column: string, value: unknown) => {
        motionFilter ||= column === 'type' && value === 'motion';
        return self;
      },
      is: () => self,
      not: () => {
        tokenFilter = true;
        return self;
      },
      limit: () => self,
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data: table === 'nodes' && motionFilter && !tokenFilter ? MOTION_ROWS : [], error: null })
    };
    return self;
  };
  return { from: chain } as unknown as Db;
}

const toUncensored = () => switchProjectMode(projectDb(), { orgId: 'o-1', userId: 'u-1', projectId: PROJECT, to: ProjectMode.Uncensored });

beforeEach(() => {
  state.published = new Set();
});

describe('a live motion embed keeps a project out of uncensored mode', () => {
  it('refuses the switch while a video of the project is published as an embed', async () => {
    state.published.add(VIDEO);

    expect(await toUncensored()).toEqual({ ok: false, error: NOT_SHAREABLE });
    expect(SWITCH_REFUSAL_TEXT[NOT_SHAREABLE]).toMatch(/unpublish/i);
  });

  it('allows it once the embed is unpublished', async () => {
    expect(await toUncensored()).toEqual({ ok: true });
  });
});
