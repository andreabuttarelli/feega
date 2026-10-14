import { z } from 'zod';
import { formatOf, type MotionDoc } from '$lib/motion/doc';
import type { Db } from '$lib/server/db/client';
import { createNode, deleteNode, findNode, listConnections } from '$lib/server/repos/canvas';
import { findAsset } from '$lib/server/repos/assets';
import type { Actor } from '$lib/server/repos/actor';
import { newMotionData } from '$lib/canvas/motion-node';
import { ADDABLE_LABEL } from '$lib/canvas/addable';
import { savedMotion } from './agent-embed';
import { saveMotionDoc } from './editor';
import { DocMode, docMode } from '$lib/motion/still';
import { OutputKind, frameOf, liftElement, linkOutput, mediaElement, placeElement, type Box, type Element, type NewId, type Output, type Point } from '$lib/motion/move-element';
import { RevisionOutcome, type RevisionWrite } from '$lib/server/repos/motion-revisions';
import type { UndoItem } from '$lib/canvas/undo-plan';

export enum MoveOutcome {
  Done = 'done',
  NotFound = 'motion_node_not_found',
  NoElement = 'element_not_found',
  SameFrame = 'same_frame',
  NoOutput = 'no_output',
  Conflict = 'conflict',
  Invalid = 'invalid'
}

export enum DropOn {
  Frame = 'frame',
  Canvas = 'canvas'
}

export type Drop = { on: DropOn.Frame; nodeId: string; at: Point; frame?: number } | { on: DropOn.Canvas; x: number; y: number };

const fraction = z.number().min(0).max(1);

export const dropSchema = z.discriminatedUnion('on', [
  z.object({ on: z.literal(DropOn.Frame), nodeId: z.string().min(1), at: z.object({ x: fraction, y: fraction }), frame: z.number().int().min(0).optional() }).strict(),
  z.object({ on: z.literal(DropOn.Canvas), x: z.number().finite(), y: z.number().finite() }).strict()
]);

export const boxSchema = z.object({ left: z.number(), top: z.number(), width: fraction.positive(), height: fraction.positive() }).strict();

export const versionsSchema = z.record(z.string(), z.number().int().min(0));

export const moveAskSchema = z.object({ sourceNodeId: z.string().min(1), clipId: z.string().min(1), drop: dropSchema, box: boxSchema.nullish(), versions: versionsSchema.optional() }).strict();

export const outputAskSchema = z.object({ sourceNodeId: z.string().min(1), drop: dropSchema }).strict();

export const MOVE_STATUS: Record<Exclude<MoveOutcome, MoveOutcome.Done>, number> = {
  [MoveOutcome.NotFound]: 404,
  [MoveOutcome.NoElement]: 404,
  [MoveOutcome.SameFrame]: 400,
  [MoveOutcome.NoOutput]: 409,
  [MoveOutcome.Conflict]: 409,
  [MoveOutcome.Invalid]: 422
};

export type StoredFrame = { nodeId: string; projectId: string; canvasId: string; version: number; doc: MotionDoc };

export type Place = { projectId: string; canvasId: string };

export type FrameStore = {
  read: (nodeId: string) => Promise<StoredFrame | null>;
  write: (nodeId: string, expectedVersion: number, doc: MotionDoc, summary: string) => Promise<RevisionWrite>;
  create: (at: Place & { x: number; y: number }, doc: MotionDoc) => Promise<string>;
  remove: (nodeId: string) => Promise<void>;
  output: (nodeId: string) => Promise<(Place & { output: Output }) | null>;
  fedFrames: (nodeId: string) => Promise<string[]>;
};

export type Moved =
  | { outcome: MoveOutcome.Done; frameId: string; clipId: string; created: boolean; versions: Record<string, number>; undo: UndoItem[] }
  | { outcome: Exclude<MoveOutcome, MoveOutcome.Done>; detail?: string };

export type MoveAsk = { sourceNodeId: string; clipId: string; drop: Drop; box?: Box | null; versions?: Record<string, number> };

export type OutputAsk = { sourceNodeId: string; drop: Drop };

const SUMMARY = {
  movedOut: 'Moved an element to another frame',
  movedIn: 'Moved an element in from another frame',
  placed: 'Placed a generated output',
  linked: 'Updated from a connected node',
  putBack: 'Put back after a failed move'
};

const FRAME_OF_OUTPUT: Record<OutputKind, DocMode> = {
  [OutputKind.Image]: DocMode.Still,
  [OutputKind.Video]: DocMode.Video,
  [OutputKind.Text]: DocMode.Still
};

const ID_LENGTH = 8;

const newId: NewId = () => crypto.randomUUID().slice(0, ID_LENGTH);

const refused = (outcome: Exclude<MoveOutcome, MoveOutcome.Done>, detail?: string): Moved => ({ outcome, detail });

const revision = (nodeId: string, before: number): UndoItem => ({ kind: 'doc.revision', nodeId, before, after: before + 1 });

const created = (nodeId: string, at: { x: number; y: number }): UndoItem => ({ kind: 'node.create', nodeId, after: { position: { x: at.x, y: at.y, z: 0 } } });

const stale = (frame: StoredFrame, versions: Record<string, number> | undefined) => versions?.[frame.nodeId] !== undefined && versions[frame.nodeId] !== frame.version;

function failedWrite(write: RevisionWrite): Moved {
  return write.outcome === RevisionOutcome.Invalid ? refused(MoveOutcome.Invalid, write.error) : refused(MoveOutcome.Conflict);
}

type Landing = { frameId: string; clipId: string; created: boolean; undo: UndoItem[]; version: number; rollback: () => Promise<void> };

async function landInFrame(store: FrameStore, target: StoredFrame, element: Element, drop: Extract<Drop, { on: DropOn.Frame }>, summary: string): Promise<Landing | Moved> {
  const placed = placeElement(target.doc, element, { at: drop.at, frame: drop.frame }, newId);
  if (!placed.ok) {
    return refused(MoveOutcome.Invalid, placed.error);
  }
  const write = await store.write(target.nodeId, target.version, placed.doc, summary);
  if (write.outcome !== RevisionOutcome.Written) {
    return failedWrite(write);
  }
  return {
    frameId: target.nodeId,
    clipId: placed.clipId,
    created: false,
    version: write.head.version,
    undo: [revision(target.nodeId, target.version)],
    rollback: async () => void (await store.write(target.nodeId, write.head.version, target.doc, SUMMARY.putBack))
  };
}

async function landOnCanvas(store: FrameStore, place: Place, element: Element, drop: Extract<Drop, { on: DropOn.Canvas }>, mode: DocMode, box: Box | null): Promise<Landing> {
  const doc = frameOf(element, mode, box, newId);
  const frameId = await store.create({ ...place, x: drop.x, y: drop.y }, doc);
  const clipId = doc.tracks.flatMap((t) => t.clips)[0]?.id ?? element.clip.id;
  return { frameId, clipId, created: true, version: 1, undo: [created(frameId, drop)], rollback: () => store.remove(frameId) };
}

const isLanding = (value: Landing | Moved): value is Landing => 'frameId' in value && !('outcome' in value);

async function targetOf(store: FrameStore, drop: Drop, versions?: Record<string, number>): Promise<StoredFrame | Moved | null> {
  if (drop.on === DropOn.Canvas) {
    return null;
  }
  const target = await store.read(drop.nodeId);
  if (!target) {
    return refused(MoveOutcome.NotFound, `no frame ${drop.nodeId}`);
  }
  return stale(target, versions) ? refused(MoveOutcome.Conflict) : target;
}

export async function moveElement(store: FrameStore, ask: MoveAsk): Promise<Moved> {
  const source = await store.read(ask.sourceNodeId);
  if (!source) {
    return refused(MoveOutcome.NotFound, `no frame ${ask.sourceNodeId}`);
  }
  if (ask.drop.on === DropOn.Frame && ask.drop.nodeId === source.nodeId) {
    return refused(MoveOutcome.SameFrame);
  }
  if (stale(source, ask.versions)) {
    return refused(MoveOutcome.Conflict);
  }

  const lifted = liftElement(source.doc, ask.clipId);
  if (!lifted.ok) {
    return refused(MoveOutcome.NoElement, lifted.error);
  }

  const target = await targetOf(store, ask.drop, ask.versions);
  if (target && !('doc' in target)) {
    return target;
  }
  const landing = target
    ? await landInFrame(store, target, lifted.element, ask.drop as Extract<Drop, { on: DropOn.Frame }>, SUMMARY.movedIn)
    : await landOnCanvas(store, source, lifted.element, ask.drop as Extract<Drop, { on: DropOn.Canvas }>, docMode(source.doc), ask.box ?? null);
  if (!isLanding(landing)) {
    return landing;
  }

  const left = await store.write(source.nodeId, source.version, lifted.doc, SUMMARY.movedOut);
  if (left.outcome !== RevisionOutcome.Written) {
    await landing.rollback();
    return failedWrite(left);
  }
  return {
    outcome: MoveOutcome.Done,
    frameId: landing.frameId,
    clipId: landing.clipId,
    created: landing.created,
    versions: { [landing.frameId]: landing.version, [source.nodeId]: left.head.version },
    undo: [...landing.undo, revision(source.nodeId, source.version)]
  };
}

export async function placeOutput(store: FrameStore, ask: OutputAsk): Promise<Moved> {
  const found = await store.output(ask.sourceNodeId);
  if (!found) {
    return refused(MoveOutcome.NoOutput, 'that node has nothing generated yet');
  }

  const target = await targetOf(store, ask.drop);
  if (target && !('doc' in target)) {
    return target;
  }
  const element = mediaElement(found.output, target?.doc.fps);
  const landing = target
    ? await landInFrame(store, target, element, ask.drop as Extract<Drop, { on: DropOn.Frame }>, SUMMARY.placed)
    : await landOnCanvas(store, found, element, ask.drop as Extract<Drop, { on: DropOn.Canvas }>, FRAME_OF_OUTPUT[found.output.kind], null);
  if (!isLanding(landing)) {
    return landing;
  }
  return { outcome: MoveOutcome.Done, frameId: landing.frameId, clipId: landing.clipId, created: landing.created, versions: { [landing.frameId]: landing.version }, undo: landing.undo };
}

export async function linkFrame(store: FrameStore, ask: { sourceNodeId: string; frameNodeId: string }): Promise<Moved> {
  const [found, frame] = await Promise.all([store.output(ask.sourceNodeId), store.read(ask.frameNodeId)]);
  if (!frame) {
    return refused(MoveOutcome.NotFound, `no frame ${ask.frameNodeId}`);
  }
  if (!found) {
    return refused(MoveOutcome.NoOutput);
  }

  const linked = linkOutput(frame.doc, ask.sourceNodeId, mediaElement(found.output, frame.doc.fps), newId);
  if (!linked.ok) {
    return refused(MoveOutcome.Invalid, linked.error);
  }
  const clipId = linked.doc.links?.[ask.sourceNodeId] ?? '';
  if (JSON.stringify(linked.doc) === JSON.stringify(frame.doc)) {
    return { outcome: MoveOutcome.Done, frameId: frame.nodeId, clipId, created: false, versions: { [frame.nodeId]: frame.version }, undo: [] };
  }

  const write = await store.write(frame.nodeId, frame.version, linked.doc, SUMMARY.linked);
  if (write.outcome !== RevisionOutcome.Written) {
    return failedWrite(write);
  }
  return { outcome: MoveOutcome.Done, frameId: frame.nodeId, clipId, created: false, versions: { [frame.nodeId]: write.head.version }, undo: [revision(frame.nodeId, frame.version)] };
}

export async function refreshLinks(store: FrameStore, sourceNodeId: string): Promise<Moved[]> {
  const frames = await store.fedFrames(sourceNodeId);
  return Promise.all(frames.map((frameNodeId) => linkFrame(store, { sourceNodeId, frameNodeId })));
}

const OUTPUT_OF_NODE: Record<string, OutputKind | undefined> = {
  image: OutputKind.Image,
  video: OutputKind.Video,
  text: OutputKind.Text
};

const OUTPUT_FIELDS = ['refId', 'assetId'] as const;

type Generated = { kind: OutputKind; name: string; asset: NonNullable<Awaited<ReturnType<typeof findAsset>>> };

const OUTPUT_OF_ASSET: Record<OutputKind, (g: Generated) => Output | null> = {
  [OutputKind.Image]: (g) => ({ kind: OutputKind.Image, assetId: g.asset.id, name: g.name, width: g.asset.width, height: g.asset.height }),
  [OutputKind.Video]: (g) => ({ kind: OutputKind.Video, assetId: g.asset.id, name: g.name, seconds: g.asset.durationS, width: g.asset.width, height: g.asset.height }),
  [OutputKind.Text]: (g) => (g.asset.content ? { kind: OutputKind.Text, text: g.asset.content, name: g.name } : null)
};

async function generatedOutput(db: Db, orgId: string, nodeId: string): Promise<(Place & { output: Output }) | null> {
  const node = await findNode(db, { orgId, nodeId });
  const kind = node ? OUTPUT_OF_NODE[node.type] : undefined;
  const field = node && OUTPUT_FIELDS.find((key) => typeof node.data[key] === 'string' && node.data[key]);
  if (!node || !kind || !field) {
    return null;
  }
  const asset = await findAsset(db, { orgId, assetId: node.data[field] as string });
  const output = asset ? OUTPUT_OF_ASSET[kind]({ kind, name: node.displayName ?? kind, asset }) : null;
  return output ? { projectId: node.projectId, canvasId: node.canvasId, output } : null;
}

async function framesFedBy(db: Db, orgId: string, nodeId: string): Promise<string[]> {
  const node = await findNode(db, { orgId, nodeId });
  if (!node) {
    return [];
  }
  const targets = (await listConnections(db, { orgId, canvasId: node.canvasId })).filter((c) => c.sourceNodeId === nodeId).map((c) => c.targetNodeId);
  const found = await Promise.all(targets.map((id) => findNode(db, { orgId, nodeId: id })));
  return found.flatMap((n) => (n?.type === 'motion' ? [n.id] : []));
}

export function frameStore(db: Db, scope: { orgId: string; actor: Actor }): FrameStore {
  const { orgId, actor } = scope;
  return {
    read: async (nodeId) => {
      const saved = await savedMotion(db, { orgId, nodeId });
      return saved ? { nodeId, projectId: saved.project.id, canvasId: saved.record.canvasId, version: saved.version, doc: saved.doc } : null;
    },
    write: (nodeId, expectedVersion, doc, summary) => saveMotionDoc(db, { orgId, nodeId, expectedVersion, doc, actor, summary }),
    create: async (at, doc) => {
      const node = await createNode(db, { orgId, projectId: at.projectId, canvasId: at.canvasId, type: 'motion', x: at.x, y: at.y, displayName: ADDABLE_LABEL.motion, data: newMotionData(formatOf(doc)), actor });
      await saveMotionDoc(db, { orgId, nodeId: node.id, expectedVersion: 0, doc, actor, summary: SUMMARY.movedIn });
      return node.id;
    },
    remove: (nodeId) => deleteNode(db, { orgId, nodeId, actor }),
    output: (nodeId) => generatedOutput(db, orgId, nodeId),
    fedFrames: (nodeId) => framesFedBy(db, orgId, nodeId)
  };
}
