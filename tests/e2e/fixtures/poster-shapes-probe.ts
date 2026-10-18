import { BUILTIN_TEMPLATES } from '../../../src/lib/motion/template/builtins';
import { FEEGA_TOKENS } from '../../../src/lib/motion/brand';
import { composeHtml } from '../../../src/lib/motion/hyperframes/compose';
import { PartKind, partKind } from '../../../src/lib/motion/poster-parts';
import { setPartFills } from '../../../src/lib/motion/part-style';
import { partUsage } from '../../../src/lib/motion/part-usage';
import { FillType, fillsSchema } from '../../../src/lib/motion/fill/model';
import type { MotionClip, MotionDoc } from '../../../src/lib/motion/doc';
import { Paint, type ShapeBox } from './poster-shapes-paint';

const RECOLOUR = fillsSchema.parse([{ type: FillType.Solid, color: '#ff00aa' }]);
const PARTS_TIMEOUT_MS = 10_000;
const POLL_MS = 50;

const posterClip = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]).find((c) => c.component === 'Custom' && partUsage(String(c.props.name))?.shapes);

const posters = (): string[] => BUILTIN_TEMPLATES.filter((e) => posterClip(e.template.doc)).map((e) => e.id);

async function partsIn(frame: HTMLIFrameElement): Promise<Element[]> {
  const until = performance.now() + PARTS_TIMEOUT_MS;
  while (performance.now() < until) {
    const found = [...(frame.contentDocument?.querySelectorAll('[data-part]') ?? [])];
    if (found.length) {
      return found;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error('the poster drew no parts');
}

async function show(doc: MotionDoc, hidden: readonly string[] = []): Promise<Element[]> {
  const frame = document.createElement('iframe');
  frame.style.cssText = `position:fixed;left:0;top:0;border:0;width:${doc.width}px;height:${doc.height}px`;
  const loaded = new Promise((r) => frame.addEventListener('load', r, { once: true }));
  const hide = hidden.map((p) => `[data-part="${p}"]{visibility:hidden !important}`).join('');
  frame.srcdoc = composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} }).replace('</head>', `<style>${hide}</style></head>`);
  document.body.replaceChildren(frame);
  await loaded;
  return partsIn(frame);
}

function recoloured(doc: MotionDoc, clip: MotionClip, parts: readonly string[]): MotionDoc {
  return parts.reduce((next, part) => {
    const result = setPartFills(next, clip.id, part, RECOLOUR);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.doc;
  }, doc);
}

async function mount(id: string, paint: Paint): Promise<ShapeBox[]> {
  const doc = BUILTIN_TEMPLATES.find((e) => e.id === id)!.template.doc;
  const clip = posterClip(doc)!;
  const drawn = await show(doc);
  const shapes = [...new Set(drawn.map((el) => el.getAttribute('data-part')!))].filter((part) => partKind(doc, clip, part) === PartKind.Shape);
  const SHOWN: Record<Paint, () => Promise<Element[]>> = {
    [Paint.Template]: async () => drawn,
    [Paint.Recoloured]: () => show(recoloured(doc, clip, shapes)),
    [Paint.Hidden]: () => show(doc, shapes)
  };
  const shown = await SHOWN[paint]();
  return shapes.map((part) => {
    const el = shown.find((e) => e.getAttribute('data-part') === part)!;
    const box = el.getBoundingClientRect();
    const x = Math.max(0, box.left);
    const y = Math.max(0, box.top);
    return { part, x, y, width: Math.min(doc.width, box.right) - x, height: Math.min(doc.height, box.bottom) - y };
  });
}

declare global {
  interface Window {
    posterShapes: { posters: typeof posters; mount: typeof mount };
  }
}

window.posterShapes = { posters, mount };
