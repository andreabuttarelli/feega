import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { ActionKind, TriggerKind } from '@feega/motion-core/motion/prototype/model';
import { putInteraction } from '$lib/motion/prototype/ops';
import { setFlow } from '$lib/motion/prototype/flows';

const saved = vi.fn();
const publishMotionEmbed = vi.fn();
const readCanvasShare = vi.fn();
const setCanvasShare = vi.fn();
const embedPublished = vi.fn();
const listNodes = vi.fn();
const readHead = vi.fn();

vi.mock('./agent-embed', () => ({
  EmbedFailure: { NotFound: 'motion_node_not_found', Refused: 'refused', Storage: 'storage_failed', Empty: 'nothing_to_publish', NotPublished: 'embed_not_published' },
  savedMotion: (...a: unknown[]) => saved(...a),
  publishMotionEmbed: (...a: unknown[]) => publishMotionEmbed(...a)
}));
vi.mock('./embed', () => ({ embedPublished: (...a: unknown[]) => embedPublished(...a) }));
vi.mock('$lib/server/canvas/canvas-share', () => ({
  ShareState: { On: 'on', Off: 'off' },
  readCanvasShare: (...a: unknown[]) => readCanvasShare(...a),
  setCanvasShare: (...a: unknown[]) => setCanvasShare(...a)
}));
vi.mock('$lib/server/repos/canvas', () => ({ listNodes: (...a: unknown[]) => listNodes(...a) }));
vi.mock('$lib/server/repos/motion-revisions', () => ({ readHead: (...a: unknown[]) => readHead(...a) }));

const { sharePlay } = await import('./agent-play');

const ORIGIN = 'https://app.test';
const SCOPE = { orgId: 'org-1', nodeId: 'a' };

function linking(target: string) {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30 }, 'c1');
  if (!added.ok) {
    throw new Error(added.error);
  }
  const put = putInteraction(added.doc, 'c1', { id: 'i1', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.Navigate, target } });
  if (!put.ok) {
    throw new Error(put.error);
  }
  return put.doc;
}

const flow = (name: string, doc = newMotionDoc(MotionFormat.Landscape)) => {
  const set = setFlow(doc, name);
  if (!set.ok) {
    throw new Error(set.error);
  }
  return set.doc;
};

const node = (id: string, y: number) => ({ id, type: 'motion', data: {}, displayName: id, position: { x: 0, y, z: 0 }, size: { width: null, height: null } });

const docs: Record<string, ReturnType<typeof linking>> = { a: flow('Onboarding', linking('b')), b: newMotionDoc(MotionFormat.Landscape), z: newMotionDoc(MotionFormat.Landscape) };

beforeEach(() => {
  vi.clearAllMocks();
  saved.mockResolvedValue({ record: { canvasId: 'c1' }, project: { mode: 'standard' }, version: 3 });
  listNodes.mockResolvedValue([node('a', 0), node('b', 400), node('z', 800)]);
  readHead.mockImplementation(async (_db: unknown, input: { nodeId: string }) => ({ version: 1, doc: docs[input.nodeId] }));
  embedPublished.mockResolvedValue(false);
  publishMotionEmbed.mockResolvedValue({ ok: true, body: { published: true } });
  readCanvasShare.mockResolvedValue(null);
  setCanvasShare.mockResolvedValue('minted');
});

describe('sharePlay', () => {
  it('publishes every frame the prototype can reach and mints the canvas link', async () => {
    const answer = await sharePlay({} as never, SCOPE, ORIGIN);

    expect(answer).toMatchObject({ ok: true, body: { url: `${ORIGIN}/play/minted?frame=a`, frames: ['a', 'b'] } });
    expect(publishMotionEmbed.mock.calls.map((c) => (c[1] as { nodeId: string }).nodeId)).toEqual(['a', 'b']);
  });

  it('leaves frames the prototype never reaches unpublished', async () => {
    await sharePlay({} as never, SCOPE, ORIGIN);

    expect(publishMotionEmbed.mock.calls.map((c) => (c[1] as { nodeId: string }).nodeId)).not.toContain('z');
  });

  it('keeps a frame that is already published as it is', async () => {
    embedPublished.mockImplementation(async (_db: unknown, id: string) => id === 'b');

    await sharePlay({} as never, SCOPE, ORIGIN);

    expect(publishMotionEmbed.mock.calls.map((c) => (c[1] as { nodeId: string }).nodeId)).toEqual(['a']);
  });

  it('lists the flows of the canvas', async () => {
    docs.z = flow('Settings');

    const answer = await sharePlay({} as never, SCOPE, ORIGIN);

    expect(answer).toMatchObject({ ok: true, body: { flows: [{ frame_id: 'a', name: 'Onboarding' }, { frame_id: 'z', name: 'Settings' }] } });
  });

  it('a project that may not share is refused before anything is published', async () => {
    saved.mockResolvedValue({ record: { canvasId: 'c1' }, project: { mode: 'uncensored' }, version: 3 });

    expect(await sharePlay({} as never, SCOPE, ORIGIN)).toMatchObject({ ok: false, failure: 'refused' });
    expect(publishMotionEmbed).not.toHaveBeenCalled();
  });

  it('a frame that cannot be published fails the share and mints nothing', async () => {
    publishMotionEmbed.mockResolvedValue({ ok: false, failure: 'nothing_to_publish', body: { error: 'nothing_to_publish' } });

    expect(await sharePlay({} as never, SCOPE, ORIGIN)).toMatchObject({ ok: false, failure: 'nothing_to_publish' });
    expect(setCanvasShare).not.toHaveBeenCalled();
  });
});
