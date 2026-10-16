import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const answer = JSON.stringify({ durationS: 5, scenes: [{ start: 0, end: 5, description: 'Logo reveal', transitionOut: 'fade' }], pacing: { cutsPerMinute: 12, rhythm: 'calm' } });
const watch = vi.hoisted(() => vi.fn(async () => ''));

vi.mock('$lib/server/video-reference', async (original) => {
  const real = await original<typeof import('$lib/server/video-reference')>();
  return { ...real, breakdownPorts: () => ({ watch, screen: async () => ({ ok: true as const }) }) };
});

const { Access, CANVAS_OPS } = await import('./canvas-ops');

const video = {
  id: 'v-1', project_id: 'p-1', type: 'video', url: 'o/p-1/upload/ref.mp4', content: null, mime_type: 'video/mp4', bytes: 10,
  width: null, height: null, duration_s: null, source: 'upload', source_node_id: null, uncensored: false, created_at: '2026-10-16'
};

describe('read_video_reference — the same breakdown for the chat, the API and MCP', () => {
  it('reads a video asset of the project into scenes, transitions and pacing, billed as a spend', async () => {
    watch.mockResolvedValueOnce(answer);
    const { db } = fakeDb({ assets: [video], projects: [{ id: 'p-1', org_id: 'o', mode: 'standard' }] }, { files: {} });
    const ctx = { db, orgId: 'o', projectId: 'p-1', userId: 'u', billed: <T>(fn: () => Promise<T>) => fn() } as never;

    const out = (await CANVAS_OPS.read_video_reference.run(ctx, { assetId: 'v-1' })) as Record<string, unknown>;

    expect(CANVAS_OPS.read_video_reference.access).toBe(Access.Spend);
    expect(out).toMatchObject({ ok: true, assetId: 'v-1', breakdown: { durationS: 5 } });
    expect(String(out.brief)).toContain('Transition out: fade');
  });
});
