import { beforeEach, describe, expect, it, vi } from 'vitest';
import { agentActor, AgentKey } from '$lib/server/repos/actor';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, setProps, setTransform, type OpResult } from '@feega/motion-core/motion/timeline';

const appendRevision = vi.fn();
const patchNodeData = vi.fn();
const findNode = vi.fn();

vi.mock('$lib/server/repos/motion-revisions', () => ({ appendRevision, readHead: vi.fn(), RevisionOutcome: { Written: 'written', Conflict: 'conflict', Invalid: 'invalid' } }));
vi.mock('./linked-mains', () => ({ nudgeInstances: async () => undefined, linkedHead: async (_db: unknown, input: { head: unknown }) => input.head }));
vi.mock('$lib/motion/linked-mains', () => ({ mainHomesOf: () => [] }));
const moveNode = vi.fn();
const resizeNode = vi.fn();

vi.mock('$lib/server/repos/canvas', () => ({ patchNodeData, resizeNode, moveNode, findNode, DataCheck: { Schema: 'schema', None: 'none' } }));

const { saveMotionDoc } = await import('./editor');

const db = {} as never;
const actor = agentActor('u', AgentKey.Mcp);

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const element = must(addClip({ ...newMotionDoc(MotionFormat.Square), width: 200, height: 100 } as MotionDoc, { component: 'Text', from: 0, props: { text: 'Ciao', x: 0.5, y: 0.5, width: 1, height: 1 } }, 'root'));
const turned = must(setTransform(element, 'root', { rotateZ: 90 }));

function nodeOf(kind: string, rotation: number) {
  findNode.mockResolvedValue({ id: 'n', type: 'motion', version: 1, data: { format: 'custom', kind, rotation }, position: { x: 40, y: 60, z: 0 }, size: { width: 200, height: 100 } });
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

describe('an agent moving or sizing the root of a free element moves or sizes its node', () => {
  const savedProps = () => findClip(appendRevision.mock.calls[0][1].doc as MotionDoc, 'root')!.clip.props;

  beforeEach(() => {
    vi.clearAllMocks();
    appendRevision.mockImplementation(async (_db: unknown, input: { doc: MotionDoc }) => ({ outcome: 'written', head: { version: 2, doc: input.doc, summary: null, actorKind: 'agent' } }));
    patchNodeData.mockResolvedValue({ outcome: 'gone' });
  });

  it('a root moved a quarter to the right moves the node 50 px and fills it again', async () => {
    nodeOf('element', 0);

    await saveMotionDoc(db, { orgId: 'o', nodeId: 'n', expectedVersion: 1, doc: must(setProps(element, 'root', { x: 0.75 })), actor });

    expect(savedProps()).toMatchObject({ x: 0.5, width: 1 });
    expect(moveNode.mock.calls[0][1]).toMatchObject({ nodeId: 'n', x: 90, y: 60 });
    expect(resizeNode).not.toHaveBeenCalled();
  });

  it('a root made half as wide makes the node half as wide', async () => {
    nodeOf('element', 0);

    await saveMotionDoc(db, { orgId: 'o', nodeId: 'n', expectedVersion: 1, doc: must(setProps(element, 'root', { x: 0.25, width: 0.5 })), actor });

    expect(savedProps()).toMatchObject({ x: 0.5, width: 1 });
    expect(resizeNode.mock.calls[0][1]).toMatchObject({ nodeId: 'n', width: 100, height: 100 });
    expect(moveNode).not.toHaveBeenCalled();
  });
});
