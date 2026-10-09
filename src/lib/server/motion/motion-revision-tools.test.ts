import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession, type RevisionLibrary } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

const blank = newMotionDoc(MotionFormat.Landscape);
const good: MotionDoc = { ...blank, durationInFrames: 600 };

function setup(revisions?: RevisionLibrary) {
  const session: MotionSession = { doc: blank, baseVersion: 20, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => 'id', voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), revisions });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

const library: RevisionLibrary = {
  list: async () => [{ version: 17, summary: 'masked f1905559', actorKind: 'agent', createdAt: '2026-10-09T09:19:11Z', clips: 14 }],
  read: async (version) => (version === 17 ? good : null)
};

describe('motion agent revision tools', () => {
  it('restore_revision puts an earlier version back as this turn edit, history untouched', async () => {
    const { session, run } = setup(library);

    const out = await run('restore_revision', { version: 17 });

    expect(out).toMatchObject({ ok: true });
    expect(session.doc).toEqual(good);
    expect(session.edits).toEqual(['restored version 17']);
    expect(session.baseVersion).toBe(20);
  });

  it('restore_revision refuses a version that does not exist', async () => {
    const { session, run } = setup(library);

    expect((await run('restore_revision', { version: 3 })).ok).toBe(false);
    expect(session.doc).toBe(blank);
  });

  it('list_revisions shows each saved version with who made it and how many clips it had', async () => {
    const { run } = setup(library);

    expect(await run('list_revisions', {})).toMatchObject({ revisions: [{ version: 17, actor: 'agent', clips: 14 }] });
  });

  it('without a revision store the tools say so instead of throwing', async () => {
    const { run } = setup();

    expect((await run('restore_revision', { version: 17 })).ok).toBe(false);
  });
});
