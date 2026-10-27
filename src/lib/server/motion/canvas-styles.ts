import { z } from 'zod';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { renameStyle } from '$lib/motion/styles';
import { adoptStyle, libraryOf, syncedDoc, type Library } from '$lib/motion/style-library';
import { styleSchema, type Style } from '@feega/motion-core/motion/styles-model';
import { RevisionOutcome, type RevisionWrite } from '$lib/server/repos/motion-revisions';

const ELEMENT_SEP = ':';

export const canvasStyleInput = z.object({
  canvasId: z.string().uuid(),
  name: z.string().min(1).max(40).optional(),
  to: z.string().min(1).max(40).optional().describe('rename: the new name, in every frame that has the style'),
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
  Apply = 'apply',
  Rename = 'rename'
}

export type StyleAsk = { name?: string; to?: string; style?: Style; ids?: string[] };

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

const ASKS: [(ask: StyleAsk) => boolean, CanvasStyleAction][] = [
  [(ask) => !!ask.to, CanvasStyleAction.Rename],
  [(ask) => !!ask.ids?.length, CanvasStyleAction.Apply],
  [(ask) => !!ask.style, CanvasStyleAction.Define]
];

export const actionOf = (ask: StyleAsk): CanvasStyleAction => ASKS.find(([matches]) => matches(ask))?.[1] ?? CanvasStyleAction.List;

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
  [CanvasStyleAction.Rename]: async (store, ask) => {
    const frames = await framesOf(store);
    const library = libraryOf(frames.map((f) => f.doc));
    if (!ask.name || !ask.to || !library[ask.name]) {
      return { ok: false, error: `rename takes an existing canvas style and a new name; no canvas style ${ask.name ?? ''}` };
    }
    if (library[ask.to]) {
      return { ok: false, error: `a canvas style ${ask.to} already exists` };
    }
    const changed = await Promise.all(
      frames.map((f) => {
        const renamed = f.doc.styles?.[ask.name!] ? renameStyle(f.doc, ask.name!, ask.to!) : null;
        return saved(store, f, renamed?.ok ? renamed.doc : null, `Renamed the ${ask.name} style to ${ask.to}`);
      })
    );
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
