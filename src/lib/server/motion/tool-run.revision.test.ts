import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';

const READ = 1;
const HEAD = 2;

function must(result: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

function seen(): MotionDoc {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'title', x: 0.5, y: 0.5 } }, 'title'));
  doc = must(addClip(doc, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'caption', x: 0.5, y: 0.8 } }, 'caption'));
  return doc;
}

const retimed = (doc: MotionDoc, id: string, at: number): MotionDoc => ({
  ...doc,
  tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, keyframes: { ...c.keyframes, opacity: [{ frame: at, value: 1 }] } } : c)) }))
}) as unknown as MotionDoc;

const base = seen();
const head = retimed(base, 'title', 24);

const commitDoc = vi.fn();

vi.mock('./agent-embed', () => ({
  savedMotionWith: async () => ({ record: { projectId: 'p', canvasId: 'c', displayName: null }, node: { format: MotionFormat.Landscape }, project: { id: 'p', brandId: null, mode: 'normal' }, version: HEAD, doc: head, alongside: [] })
}));
vi.mock('$lib/server/repos/motion-revisions', async (real) => ({ ...(await real<object>()), readRevision: async (_db: unknown, ask: { version: number }) => (ask.version === READ ? { version: READ, doc: base } : null) }));
vi.mock('./frame-ops', async (real) => ({ ...(await real<object>()), commitDoc: (...a: unknown[]) => commitDoc(...a) }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));
vi.mock('$lib/server/canvas/agent-cursor', () => ({ showAgentAt: () => undefined }));

const { runMotionTool, ToolRun } = await import('./tool-run');

const scope = { orgId: 'o', userId: 'u', nodeId: 'n' };

beforeEach(() => {
  commitDoc.mockReset();
  commitDoc.mockImplementation(async (_db: unknown, ask: { doc: MotionDoc }) => ({ outcome: 'written', head: { version: HEAD + 1, doc: ask.doc }, rebased: false }));
});

describe('an agent edit carries the revision it read', () => {
  it('touching a clip a human retimed since then is a conflict, and the human timing stays', async () => {
    const ran = await runMotionTool({} as never, scope, { tool: 'set_props', input: { clip_id: 'title', props: { y: 0.4 } }, version: READ });

    expect(ran).toMatchObject({ outcome: ToolRun.Conflict, changed: [{ id: 'title', now: { keyframes: { opacity: [{ frame: 24 }] } } }] });
    expect(commitDoc).not.toHaveBeenCalled();
  });

  it('touching another clip lands on top of the human edit', async () => {
    const ran = await runMotionTool({} as never, scope, { tool: 'set_props', input: { clip_id: 'caption', props: { y: 0.9 } }, version: READ });

    expect(ran).toMatchObject({ outcome: ToolRun.Done, saved: true });
    const written = commitDoc.mock.calls[0][1].doc as MotionDoc;
    expect(findClip(written, 'title')?.clip.keyframes?.opacity?.[0]).toMatchObject({ frame: 24 });
    expect(findClip(written, 'caption')?.clip.props.y).not.toBe(0.8);
  });
});
