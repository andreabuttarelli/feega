import { z } from 'zod';
import type { MotionDoc } from '$lib/motion/doc';
import { adoptCollection, syncedCollection, variableLibraryOf } from '$lib/motion/variable-library';
import { bindVariable, defineVariable, setActiveMode } from '$lib/motion/variables';
import { VARIABLE_NAME, VarType, keyOf, type Collection, type VarInput, type Variables } from '$lib/motion/variables-model';
import { RevisionOutcome, type RevisionWrite } from '$lib/server/repos/motion-revisions';

const ELEMENT_SEP = ':';

export const canvasVariableInput = z.object({
  canvasId: z.string().uuid(),
  collection: z.string().regex(VARIABLE_NAME).optional(),
  name: z.string().regex(VARIABLE_NAME).optional(),
  type: z.enum(VarType).optional(),
  values: z.record(z.string(), z.unknown()).optional().describe('define: {mode: value or {alias: "Collection/name"}}; every mode of the collection needs one'),
  modes: z.array(z.string().regex(VARIABLE_NAME)).optional().describe('define: the modes of a new collection, first is the default'),
  mode: z.string().regex(VARIABLE_NAME).optional().describe('switch the collection to this mode, in the frames named (all frames that have it when none)'),
  frames: z.array(z.string()).optional().describe('define: frames to put a new collection in; mode: the frames to switch'),
  ids: z.array(z.string()).optional().describe('bind (with collection, name, target) to frameId:elementId; none of values/mode/ids lists the canvas collections')
});

export type VariableFrames = {
  ids: () => Promise<string[]>;
  read: (id: string) => Promise<{ version: number; doc: MotionDoc } | null>;
  write: (id: string, version: number, doc: MotionDoc, summary: string) => Promise<RevisionWrite>;
};

export enum CanvasVariableAction {
  List = 'list',
  Define = 'define',
  Mode = 'mode',
  Bind = 'bind'
}

export type VariableAsk = {
  collection?: string;
  name?: string;
  type?: VarType;
  values?: Record<string, unknown>;
  modes?: string[];
  mode?: string;
  frames?: string[];
  ids?: string[];
  target?: string;
};

export type VariableAnswer = { ok: true; variables?: Variables; frames?: string[] } | { ok: false; error: string };

type Frame = { id: string; version: number; doc: MotionDoc };

async function framesOf(store: VariableFrames): Promise<Frame[]> {
  const ids = await store.ids();
  return (await Promise.all(ids.map(async (id) => ({ id, head: await store.read(id) })))).flatMap((f) => (f.head ? [{ id: f.id, ...f.head }] : []));
}

const written = (w: RevisionWrite) => w.outcome === RevisionOutcome.Written;

async function saved(store: VariableFrames, frame: Frame, doc: MotionDoc | null, summary: string): Promise<string[]> {
  return doc && written(await store.write(frame.id, frame.version, doc, summary)) ? [frame.id] : [];
}

function byFrame(ids: readonly string[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const id of ids) {
    const at = id.indexOf(ELEMENT_SEP);
    const frame = id.slice(0, at);
    grouped.set(frame, [...(grouped.get(frame) ?? []), id.slice(at + 1)]);
  }
  return grouped;
}

const ASKS: [(ask: VariableAsk) => boolean, CanvasVariableAction][] = [
  [(ask) => !!ask.ids?.length, CanvasVariableAction.Bind],
  [(ask) => !!ask.mode, CanvasVariableAction.Mode],
  [(ask) => !!ask.values, CanvasVariableAction.Define]
];

export const actionOf = (ask: VariableAsk): CanvasVariableAction => ASKS.find(([matches]) => matches(ask))?.[1] ?? CanvasVariableAction.List;

const owns = (frame: Frame, collection: string) => !!frame.doc.variables?.[collection];

function withCollection(frame: Frame, name: string, collection: Collection): MotionDoc | null {
  if (owns(frame, name)) {
    return syncedCollection(frame.doc, name, collection);
  }
  const adopted = adoptCollection(frame.doc, name, collection);
  return adopted.ok ? adopted.doc : null;
}

const named = (frames: Frame[], ask: VariableAsk) => frames.filter((f) => (ask.frames ?? []).includes(f.id));

const ACTIONS: Record<CanvasVariableAction, (store: VariableFrames, ask: VariableAsk) => Promise<VariableAnswer>> = {
  [CanvasVariableAction.List]: async (store) => ({ ok: true, variables: variableLibraryOf((await framesOf(store)).map((f) => f.doc)) }),
  [CanvasVariableAction.Define]: async (store, ask) => {
    if (!ask.collection || !ask.name || !ask.type || !ask.values) {
      return { ok: false, error: 'define takes collection, name, type and values' };
    }
    const frames = await framesOf(store);
    const targets = frames.filter((f) => owns(f, ask.collection!) || (ask.frames ?? []).includes(f.id));
    const seed = targets.find((f) => owns(f, ask.collection!)) ?? targets[0];
    if (!seed) {
      return { ok: false, error: `no frame has the collection ${ask.collection}: name frames to put it in` };
    }
    const defined = defineVariable(seed.doc, ask.collection, ask.name, { type: ask.type, values: ask.values } as VarInput, ask.modes);
    if (!defined.ok) {
      return defined;
    }
    const canonical = defined.doc.variables![ask.collection];
    const summary = `Updated the ${keyOf(ask.collection, ask.name)} variable`;
    const changed = await Promise.all(
      targets.map((f) => {
        if (f === seed) {
          return saved(store, f, defined.doc, summary);
        }
        return saved(store, f, withCollection(f, ask.collection!, canonical), summary);
      })
    );
    return { ok: true, frames: changed.flat() };
  },
  [CanvasVariableAction.Mode]: async (store, ask) => {
    if (!ask.collection || !ask.mode) {
      return { ok: false, error: 'mode takes collection and mode' };
    }
    const frames = await framesOf(store);
    const targets = ask.frames?.length ? named(frames, ask) : frames.filter((f) => owns(f, ask.collection!));
    const changed: string[] = [];
    for (const frame of targets) {
      const switched = setActiveMode(frame.doc, ask.collection, ask.mode);
      if (!switched.ok) {
        return { ok: false, error: `${frame.id}: ${switched.error}` };
      }
      changed.push(...(await saved(store, frame, switched.doc, `${ask.collection} mode ${ask.mode}`)));
    }
    return { ok: true, frames: changed };
  },
  [CanvasVariableAction.Bind]: async (store, ask) => {
    const frames = await framesOf(store);
    const collection = ask.collection ? variableLibraryOf(frames.map((f) => f.doc))[ask.collection] : undefined;
    if (!ask.collection || !ask.name || !ask.target || !collection) {
      return { ok: false, error: `bind takes collection, name, target and ids; no canvas collection ${ask.collection ?? ''}` };
    }
    const changed: string[] = [];
    for (const [frameId, elements] of byFrame(ask.ids ?? [])) {
      const frame = frames.find((f) => f.id === frameId);
      if (!frame) {
        return { ok: false, error: `no frame ${frameId} on this canvas` };
      }
      let doc = adoptCollection(frame.doc, ask.collection, collection);
      for (const element of elements) {
        doc = doc.ok ? bindVariable(doc.doc, element, ask.target, keyOf(ask.collection, ask.name)) : doc;
      }
      if (!doc.ok) {
        return doc;
      }
      changed.push(...(await saved(store, frame, doc.doc, `Bound ${ask.target} to ${keyOf(ask.collection, ask.name)}`)));
    }
    return { ok: true, frames: changed };
  }
};

export const canvasVariable = (store: VariableFrames, ask: VariableAsk): Promise<VariableAnswer> => ACTIONS[actionOf(ask)](store, ask);
