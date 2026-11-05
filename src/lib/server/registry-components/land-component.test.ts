import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { VarType } from '@feega/motion-core/motion/variables-model';
import { DEFAULT_AUTO_LAYOUT } from '@feega/motion-core/motion/layout/model';
import { RevisionOutcome, type RevisionWrite } from '$lib/server/repos/motion-revisions';
import { MoveOutcome, type FrameStore, type StoredFrame } from '$lib/server/motion/move-element';
import { landInFrame } from './land-component';

function must(result: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

function memory() {
  const frames = new Map<string, StoredFrame>();
  const removed: string[] = [];
  const store: FrameStore = {
    read: async (nodeId) => frames.get(nodeId) ?? null,
    write: async (nodeId, expected, doc): Promise<RevisionWrite> => {
      const now = frames.get(nodeId);
      if (!now || now.version !== expected) {
        return { outcome: RevisionOutcome.Conflict };
      }
      frames.set(nodeId, { ...now, version: expected + 1, doc });
      return { outcome: RevisionOutcome.Written, head: { version: expected + 1, doc, summary: null, actorKind: 'user' } };
    },
    create: async () => 'unused',
    remove: async (nodeId) => {
      removed.push(nodeId);
      frames.delete(nodeId);
    },
    output: async () => null
  };
  const seed = (nodeId: string, doc: MotionDoc) => frames.set(nodeId, { nodeId, projectId: 'p1', canvasId: 'c1', version: 1, doc });
  return { store, frames, removed, seed };
}

const SHADCN = { shadcn: { modes: ['Default'], vars: { Text: { type: VarType.Colour, values: { Default: '#0a0a0a' } } } } };

const PARENTS: Record<string, string> = { card: 'stage', title: 'card' };

function imported(): MotionDoc {
  const stage = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 60, props: { x: 0.5, y: 0.5, width: 1, height: 1 } }, 'stage'));
  const card = must(addClip(stage, { component: 'Shape', from: 0, durationInFrames: 60, props: { x: 0.5, y: 0.5, width: 0.3, height: 0.4 } }, 'card'));
  const title = must(addClip(card, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'Login', x: 0.5, y: 0.4 } }, 'title'));
  return { ...title, variables: SHADCN, tracks: title.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, parent: PARENTS[c.id] ?? null, ...(c.id === 'title' ? { bind: { color: 'shadcn/Text' } } : {}) })) })) };
}

const named = (doc: MotionDoc, test: (c: MotionClip) => boolean) => doc.tracks.flatMap((t) => t.clips as MotionClip[]).find(test);

function withStack(): MotionDoc {
  const doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 60, props: { x: 0.8, y: 0.8, width: 0.2, height: 0.2 } }, 'list'));
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, autoLayout: DEFAULT_AUTO_LAYOUT })) })) };
}

describe('a component landed in a frame that already exists', () => {
  it('lands the component with everything inside it, not the page around it, with its variables, and drops the frame it was read into', async () => {
    const m = memory();
    m.seed('read', imported());
    m.seed('target', newMotionDoc(MotionFormat.Landscape));

    const landed = await landInFrame(m.store, 'read', { frameId: 'target', at: { x: 0.25, y: 0.25 } });

    const doc = m.frames.get('target')!.doc;
    const card = named(doc, (c) => c.component === 'Shape' && c.id !== doc.surface)!;
    const title = named(doc, (c) => c.props.text === 'Login')!;
    expect(landed).toMatchObject({ outcome: MoveOutcome.Done, clipId: card.id });
    expect(title.parent).toBe(card.id);
    expect(title.bind).toEqual({ color: 'shadcn/Text' });
    expect(card.props).toMatchObject({ x: 0.25, y: 0.25 });
    expect(doc.tracks.flatMap((t) => t.clips)).toHaveLength(2);
    expect(doc.variables).toMatchObject(SHADCN);
    expect(m.removed).toEqual(['read']);
  });

  it('lands inside the stack it is asked for, wherever that stack sits in the frame', async () => {
    const m = memory();
    m.seed('read', imported());
    m.seed('target', withStack());

    await landInFrame(m.store, 'read', { frameId: 'target', parentId: 'list', at: { x: 0.1, y: 0.1 } });

    expect(named(m.frames.get('target')!.doc, (c) => c.component === 'Shape' && c.id !== 'list' && !c.props.text)?.parent).toBe('list');
  });
});
