import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, setTransform, type OpResult } from '@feega/motion-core/motion/timeline';

const appendRevision = vi.fn();
const patchNodeData = vi.fn();
const findNode = vi.fn();

vi.mock('$lib/server/repos/motion-revisions', () => ({ appendRevision, readHead: vi.fn(), RevisionOutcome: { Written: 'written', Conflict: 'conflict', Invalid: 'invalid' } }));
vi.mock('./linked-mains', () => ({ nudgeInstances: async () => undefined, linkedHead: async (_db: unknown, input: { head: unknown }) => input.head }));
vi.mock('$lib/motion/linked-mains', () => ({ mainHomesOf: () => [] }));
vi.mock('$lib/server/repos/canvas', () => ({ patchNodeData, resizeNode: vi.fn(), findNode, DataCheck: { Schema: 'schema', None: 'none' } }));

const { saveMotionDoc } = await import('./editor');

const db = {} as never;
const actor = { kind: 'agent' as const, id: 'u' };

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const element = must(addClip({ ...newMotionDoc(MotionFormat.Square), width: 200, height: 100 } as MotionDoc, { component: 'Text', from: 0, props: { text: 'Ciao', x: 0.5, y: 0.5, width: 1, height: 1 } }, 'root'));
const turned = must(setTransform(element, 'root', { rotateZ: 90 }));

function nodeOf(kind: string, rotation: number) {
  findNode.mockResolvedValue({ id: 'n', type: 'motion', version: 1, data: { format: 'custom', kind, rotation }, size: { width: 200, height: 100 } });
}

const savedRoot = () => findClip(appendRevision.mock.calls[0][1].doc as MotionDoc, 'root')!.clip.transform.rotateZ ?? 0;

describe('an agent rotating a free element turns its node, like the canvas does', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appendRevision.mockImplementation(async (_db: unknown, input: { doc: MotionDoc }) => ({ outcome: 'written', head: { version: 2, doc: input.doc, summary: null, actorKind: 'agent' } }));
    patchNodeData.mockResolvedValue({ outcome: 'gone' });
  });

  it('the turn leaves the doc and lands on the node rotation', async () => {
    nodeOf('element', 10);

    await saveMotionDoc(db, { orgId: 'o', nodeId: 'n', expectedVersion: 1, doc: turned, actor });

    expect(savedRoot()).toBe(0);
    expect(patchNodeData.mock.calls[0][1].patch.rotation).toBe(100);
  });

  it('a frame keeps the turn inside its doc', async () => {
    nodeOf('frame', 0);

    await saveMotionDoc(db, { orgId: 'o', nodeId: 'n', expectedVersion: 1, doc: turned, actor });

    expect(savedRoot()).toBe(90);
    expect(patchNodeData.mock.calls[0][1].patch.rotation).toBeUndefined();
  });
});
