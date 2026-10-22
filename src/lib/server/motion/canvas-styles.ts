import { z } from 'zod';
import type { MotionDoc } from '$lib/motion/doc';
import { adoptStyle, libraryOf, syncedDoc, type Library } from '$lib/motion/style-library';
import { styleSchema, type Style } from '$lib/motion/styles-model';
import { RevisionOutcome, type RevisionWrite } from '$lib/server/repos/motion-revisions';

const ELEMENT_SEP = ':';

export const canvasStyleInput = z.object({
  canvasId: z.string().uuid(),
  name: z.string().min(1).max(40).optional(),
  style: styleSchema.optional().describe('define: restyles every frame with this name'),
  ids: z.array(z.string()).optional().describe('apply name to frameId:elementId; none of style/ids lists the canvas styles')
});

export type StyleFrames = {
  ids: () => Promise<string[]>;
  read: (id: string) => Promise<{ version: number; doc: MotionDoc } | null>;
  write: (id: string, version: number, doc: MotionDoc, summary: string) => Promise<RevisionWrite>;
};

export enum CanvasStyleAction {
  List = 'list',
  Define = 'define',
  Apply = 'apply'
}

export type StyleAsk = { name?: string; style?: Style; ids?: string[] };

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

export const actionOf = (ask: StyleAsk): CanvasStyleAction => (ask.ids?.length ? CanvasStyleAction.Apply : ask.style ? CanvasStyleAction.Define : CanvasStyleAction.List);

const ACTIONS: Record<CanvasStyleAction, (store: StyleFrames, ask: StyleAsk) => Promise<StyleAnswer>> = {
  [CanvasStyleAction.List]: async (store) => ({ ok: true, styles: libraryOf((await framesOf(store)).map((f) => f.doc)) }),
  [CanvasStyleAction.Define]: async (store, ask) => {
    if (!ask.name || !ask.style) {
      return { ok: false, error: 'define takes name and style' };
    }
    const frames = await framesOf(store);
    const changed = await Promise.all(frames.map((f) => saved(store, f, syncedDoc(f.doc, ask.name!, ask.style!), `Updated the ${ask.name} style`)));
    return { ok: true, frames: changed.flat() };
  },
  [CanvasStyleAction.Apply]: async (store, ask) => {
    const frames = await framesOf(store);
    const style = ask.name ? libraryOf(frames.map((f) => f.doc))[ask.name] : undefined;
    if (!ask.name || !style) {
      return { ok: false, error: `no canvas style ${ask.name ?? ''}` };
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
