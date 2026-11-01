import { z } from 'zod';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { removeStyle, renameStyle } from '$lib/motion/styles';
import { adoptStyle, libraryOf, syncedDoc, type Library } from '$lib/motion/style-library';
import { styleSchema, type Style } from '@feega/motion-core/motion/styles-model';
import { RevisionOutcome, type RevisionWrite } from '$lib/server/repos/motion-revisions';
import { LibraryOp, type LibraryPort } from '$lib/motion/project-library-ops';

const ELEMENT_SEP = ':';

export const canvasStyleInput = z.object({
  canvasId: z.string().uuid(),
  name: z.string().min(1).max(40).optional(),
  to: z.string().min(1).max(40).optional().describe('rename: the new name, in the project and every frame that has the style'),
  style: styleSchema.optional().describe('define: saves the project style and restyles every frame with this name'),
  ids: z.array(z.string()).optional().describe('apply name to nodeId:elementId, a frame or a free element alike; none of style/ids/remove lists the project styles'),
  remove: z.boolean().optional().describe('remove: deletes the project style; its elements keep their look, unlinked')
});

export type StyleFrames = {
  project: LibraryPort;
  ids: () => Promise<string[]>;
  read: (id: string) => Promise<{ version: number; doc: MotionDoc } | null>;
  write: (id: string, version: number, doc: MotionDoc, summary: string) => Promise<RevisionWrite>;
};

export enum CanvasStyleAction {
  List = 'list',
  Define = 'define',
  Apply = 'apply',
  Rename = 'rename',
  Remove = 'remove'
}

export type StyleAsk = { name?: string; to?: string; style?: Style; ids?: string[]; remove?: boolean };

export type StyleAnswer = { ok: true; styles?: Library; frames?: string[] } | { ok: false; error: string };

type Frame = { id: string; version: number; doc: MotionDoc };

async function framesOf(store: StyleFrames): Promise<Frame[]> {
  const ids = await store.ids();
  return (await Promise.all(ids.map(async (id) => ({ id, head: await store.read(id) })))).flatMap((f) => (f.head ? [{ id: f.id, ...f.head }] : []));
}

const written = (w: RevisionWrite) => w.outcome === RevisionOutcome.Written;

function byFrame(ids: readonly string[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const id of ids) {
    const at = id.indexOf(ELEMENT_SEP);
    const frame = id.slice(0, at);
    grouped.set(frame, [...(grouped.get(frame) ?? []), id.slice(at + 1)]);
  }
  return grouped;
}

async function saved(store: StyleFrames, frame: Frame, doc: MotionDoc | null, summary: string): Promise<string[]> {
  return doc && written(await store.write(frame.id, frame.version, doc, summary)) ? [frame.id] : [];
}

async function projectLibrary(store: StyleFrames, frames: readonly Frame[]): Promise<Library> {
  const held = (await store.project.load()) as Library;
  const found = libraryOf(frames.map((f) => f.doc));
  const fresh = Object.fromEntries(Object.entries(found).filter(([name]) => !held[name]));
  if (Object.keys(fresh).length) {
    await store.project.run({ op: LibraryOp.Adopt, entries: fresh });
  }
  return { ...held, ...fresh };
}

async function inFrames(store: StyleFrames, frames: readonly Frame[], change: (doc: MotionDoc) => MotionDoc | null, summary: string): Promise<string[]> {
  return (await Promise.all(frames.map((f) => saved(store, f, change(f.doc), summary)))).flat();
}

const ASKS: [(ask: StyleAsk) => boolean, CanvasStyleAction][] = [
  [(ask) => !!ask.remove, CanvasStyleAction.Remove],
  [(ask) => !!ask.to, CanvasStyleAction.Rename],
  [(ask) => !!ask.ids?.length, CanvasStyleAction.Apply],
  [(ask) => !!ask.style, CanvasStyleAction.Define]
];

export const actionOf = (ask: StyleAsk): CanvasStyleAction => ASKS.find(([matches]) => matches(ask))?.[1] ?? CanvasStyleAction.List;

const ACTIONS: Record<CanvasStyleAction, (store: StyleFrames, ask: StyleAsk) => Promise<StyleAnswer>> = {
  [CanvasStyleAction.List]: async (store) => ({ ok: true, styles: await projectLibrary(store, await framesOf(store)) }),
  [CanvasStyleAction.Define]: async (store, ask) => {
    if (!ask.name || !ask.style) {
      return { ok: false, error: 'define takes name and style' };
    }
    const stored = await store.project.run({ op: LibraryOp.Save, name: ask.name, value: ask.style });
    if (!stored.ok) {
      return stored;
    }
    const frames = await framesOf(store);
    return { ok: true, frames: await inFrames(store, frames, (doc) => syncedDoc(doc, ask.name!, ask.style!), `Updated the ${ask.name} style`) };
  },
  [CanvasStyleAction.Rename]: async (store, ask) => {
    const frames = await framesOf(store);
    const library = await projectLibrary(store, frames);
    if (!ask.name || !ask.to || !library[ask.name]) {
      return { ok: false, error: `rename takes an existing project style and a new name; no project style ${ask.name ?? ''}` };
    }
    if (library[ask.to]) {
      return { ok: false, error: `a project style ${ask.to} already exists` };
    }
    const stored = await store.project.run({ op: LibraryOp.Rename, name: ask.name, to: ask.to });
    if (!stored.ok) {
      return stored;
    }
    const rename = (doc: MotionDoc) => {
      const renamed = doc.styles?.[ask.name!] ? renameStyle(doc, ask.name!, ask.to!) : null;
      return renamed?.ok ? renamed.doc : null;
    };
    return { ok: true, frames: await inFrames(store, frames, rename, `Renamed the ${ask.name} style to ${ask.to}`) };
  },
  [CanvasStyleAction.Remove]: async (store, ask) => {
    const frames = await framesOf(store);
    const library = await projectLibrary(store, frames);
    if (!ask.name || !library[ask.name]) {
      return { ok: false, error: `no project style ${ask.name ?? ''}` };
    }
    const stored = await store.project.run({ op: LibraryOp.Remove, name: ask.name });
    if (!stored.ok) {
      return stored;
    }
    const remove = (doc: MotionDoc) => {
      const removed = doc.styles?.[ask.name!] ? removeStyle(doc, ask.name!) : null;
      return removed?.ok ? removed.doc : null;
    };
    return { ok: true, frames: await inFrames(store, frames, remove, `Removed the ${ask.name} style`) };
  },
  [CanvasStyleAction.Apply]: async (store, ask) => {
    const frames = await framesOf(store);
    const style = ask.name ? (await projectLibrary(store, frames))[ask.name] : undefined;
    if (!ask.name || !style) {
      return { ok: false, error: `no project style ${ask.name ?? ''}` };
    }
    const changed: string[] = [];
    for (const [frameId, elements] of byFrame(ask.ids ?? [])) {
      const frame = frames.find((f) => f.id === frameId);
      const adopted = frame ? adoptStyle(frame.doc, elements, ask.name, style) : null;
      if (!frame || !adopted?.ok) {
        return { ok: false, error: adopted && !adopted.ok ? adopted.error : `no frame ${frameId} on this canvas` };
      }
      changed.push(...(await saved(store, frame, adopted.doc, `Applied the ${ask.name} style`)));
    }
    return { ok: true, frames: changed };
  }
};

export const canvasStyle = (store: StyleFrames, ask: StyleAsk): Promise<StyleAnswer> => ACTIONS[actionOf(ask)](store, ask);
