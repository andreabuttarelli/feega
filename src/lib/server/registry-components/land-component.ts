import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { dropLayer } from '$lib/canvas/layers';
import { Place } from '$lib/motion/layer-place';
import { withSubtrees } from '$lib/motion/main-component';
import { clipCentre, liftElement, placeElement, type NewId } from '$lib/motion/move-element';
import { KeepWorld, setParent } from '$lib/motion/parent-ops';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { MoveOutcome, refused, type FrameStore, type Moved } from '$lib/server/motion/move-element';

export type FrameSpot = { frameId: string; parentId?: string; at: { x: number; y: number } };

const LANDED_SUMMARY = 'Component landed';
const ID_LENGTH = 8;

const freshId: NewId = () => crypto.randomUUID().slice(0, ID_LENGTH);

type Landed = { ok: true; doc: MotionDoc; rootId: string } | { ok: false; error: string };

function componentOf(doc: MotionDoc): MotionClip | null {
  const clips = doc.tracks.flatMap((t) => t.clips as MotionClip[]);
  const top = clips.filter((c) => !c.parent && c.id !== doc.surface);
  if (top.length !== 1) {
    return null;
  }

  const [stage] = top;
  const kids = clips.filter((c) => c.parent === stage.id);
  return kids.length === 1 ? kids[0] : stage;
}

function withLibrary(doc: MotionDoc, from: MotionDoc): MotionDoc {
  const variables = { ...doc.variables };
  for (const [name, collection] of Object.entries(from.variables ?? {})) {
    const held = variables[name];
    variables[name] = held ? { ...held, vars: { ...collection.vars, ...held.vars } } : collection;
  }

  return { ...doc, variables, styles: { ...from.styles, ...doc.styles } };
}

function depthOf(byId: Map<string, MotionClip>, clip: MotionClip): number {
  let depth = 0;
  for (let at = clip.parent; at && byId.has(at); at = byId.get(at)!.parent) {
    depth++;
  }
  return depth;
}

function transplanted(target: MotionDoc, source: MotionDoc, root: MotionClip, spot: FrameSpot, newId: NewId): Landed {
  const byId = new Map(source.tracks.flatMap((t) => t.clips as MotionClip[]).map((c) => [c.id, c]));
  const tree = withSubtrees(source, [root.id]).map((id) => byId.get(id)!);
  const ordered = [...tree].sort((a, b) => depthOf(byId, a) - depthOf(byId, b));
  const rootAt = clipCentre(root);
  const renamed = new Map<string, string>();
  let doc = target;

  for (const clip of ordered) {
    const lifted = liftElement(source, clip.id);
    if (!lifted.ok) {
      return lifted;
    }

    const centre = clipCentre(clip);
    const at = { x: spot.at.x + ((centre.x - rootAt.x) * source.width) / target.width, y: spot.at.y + ((centre.y - rootAt.y) * source.height) / target.height };
    const placed = placeElement(doc, lifted.element, { at, frame: clip.from }, newId);
    if (!placed.ok) {
      return placed;
    }

    renamed.set(clip.id, placed.clipId);
    const parent = clip.parent ? renamed.get(clip.parent) : undefined;
    const parented = parent ? setParent(placed.doc, placed.clipId, parent, { keep: KeepWorld.No }) : { ok: true as const, doc: placed.doc };
    if (!parented.ok) {
      return parented;
    }
    doc = parented.doc;
  }

  const rootId = renamed.get(root.id)!;
  const slotted = spot.parentId ? dropLayer(doc, rootId, spot.parentId, Place.Into, newId) : { ok: true as const, doc };
  return slotted.ok ? { ok: true, doc: withLibrary(slotted.doc, source), rootId } : slotted;
}

export async function landInFrame(store: FrameStore, readId: string, spot: FrameSpot, newId: NewId = freshId): Promise<Moved> {
  const [read, target] = await Promise.all([store.read(readId), store.read(spot.frameId)]);
  if (!read || !target) {
    return refused(MoveOutcome.NotFound, `no frame ${read ? spot.frameId : readId}`);
  }

  const component = componentOf(read.doc);
  if (!component) {
    return refused(MoveOutcome.NoElement, 'the component did not come in as one layer');
  }

  const landed = transplanted(target.doc, read.doc, component, spot, newId);
  if (!landed.ok) {
    return refused(MoveOutcome.Invalid, landed.error);
  }

  const written = await store.write(spot.frameId, target.version, landed.doc, LANDED_SUMMARY);
  if (written.outcome !== RevisionOutcome.Written) {
    return refused(MoveOutcome.Conflict);
  }

  await store.remove(readId);
  return { outcome: MoveOutcome.Done, frameId: spot.frameId, clipId: landed.rootId, created: false, versions: { [spot.frameId]: target.version + 1 }, undo: [{ kind: 'doc.revision', nodeId: spot.frameId, before: target.version, after: target.version + 1 }] };
}
