import { compile, createRuntime, draw, type Compiled, type Runtime } from '@feega/shader-fx/gl';
import { measure } from '@feega/shader-fx/measure';
import type { ShaderBake } from './compose';

type Media = HTMLImageElement | HTMLVideoElement;

type Item = { bake: ShaderBake; host: HTMLElement; canvas: HTMLCanvasElement; scratch: HTMLCanvasElement; rt: Runtime; program: Compiled };

const PERCENT = 100;

function naturalSize(media: Media): [number, number] {
  return media instanceof HTMLVideoElement ? [media.videoWidth, media.videoHeight] : [media.naturalWidth, media.naturalHeight];
}

function shown(media: Media): boolean {
  const style = getComputedStyle(media);
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
}

function percent(token: string | undefined): number {
  return token?.endsWith('%') ? Number.parseFloat(token) / PERCENT : 0.5;
}

function zoomOf(style: CSSStyleDeclaration): number {
  const m = /matrix\(([^,]+)/.exec(style.transform);
  return m ? Number(m[1]) : 1;
}

function paint(scratch: HTMLCanvasElement, media: Media, width: number, height: number) {
  const [nw, nh] = naturalSize(media);
  const ctx = scratch.getContext('2d')!;
  scratch.width = width;
  scratch.height = height;
  ctx.clearRect(0, 0, width, height);
  if (!nw || !nh) {
    return;
  }

  const style = getComputedStyle(media);
  const ratio = style.objectFit === 'contain' ? Math.min(width / nw, height / nh) : style.objectFit === 'fill' ? 0 : Math.max(width / nw, height / nh);
  const [dw, dh] = ratio ? [nw * ratio, nh * ratio] : [width, height];
  const [px, py] = style.objectPosition.split(' ').map((t) => t.trim());
  const [fx, fy] = [percent(px), percent(py)];
  const zoom = zoomOf(style);
  const x = (width - dw) * fx;
  const y = (height - dh) * fy;
  const ox = width * fx;
  const oy = height * fy;
  ctx.drawImage(media, ox + (x - ox) * zoom, oy + (y - oy) * zoom, dw * zoom, dh * zoom);
}

function valueAt(value: ShaderBake['values'][string], frame: number) {
  return Array.isArray(value) ? value[Math.min(value.length - 1, Math.max(0, frame))] : value;
}

function setup(bake: ShaderBake): Item | null {
  const host = document.getElementById(`mv-${bake.clipId}`);
  if (!host) {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.dataset.shader = bake.clipId;
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';
  const rt = createRuntime(canvas);
  if (!rt) {
    return null;
  }

  const program = compile(rt, bake);
  if ('problems' in program) {
    return null;
  }

  host.style.position = host.style.position || 'relative';
  host.appendChild(canvas);
  return { bake, host, canvas, scratch: document.createElement('canvas'), rt, program };
}

function render(item: Item, time: number) {
  const { bake } = item;
  const local = time - bake.start;
  if (local < 0 || local * bake.fps >= bake.frames) {
    return;
  }

  const media = [...item.host.querySelectorAll<Media>('img,video')].find(shown);
  if (!media) {
    return;
  }

  const scale = window.devicePixelRatio || 1;
  paint(item.scratch, media, Math.max(1, Math.round(item.host.offsetWidth * scale)), Math.max(1, Math.round(item.host.offsetHeight * scale)));
  const frame = Math.round(local * bake.fps);
  const values = Object.fromEntries(Object.entries(bake.values).map(([k, v]) => [k, valueAt(v, frame)]));
  draw(item.rt, item.program, item.scratch, { time: local, seed: bake.seed, values });
}

function shaderClips(bakes: ShaderBake[], onDispose: (fn: () => void) => void): (time: number) => void {
  const items = bakes.map(setup).filter((i): i is Item => i !== null);
  onDispose(() => items.forEach((i) => i.canvas.remove()));
  return (time) => items.forEach((i) => render(i, time));
}

type Still = { frag: string; params: ShaderBake['params']; values: Record<string, number | string>; image: string };

async function renderStill(still: Still): Promise<string> {
  const image = new Image();
  image.src = still.image;
  await image.decode();
  const canvas = document.createElement('canvas');
  const rt = createRuntime(canvas);
  if (!rt) {
    return still.image;
  }

  const program = compile(rt, still);
  draw(rt, program, image, { time: 0, seed: 0, values: still.values });
  return canvas.toDataURL('image/png');
}

declare global {
  interface Window {
    __shaderClips: typeof shaderClips;
    __shaderFx: { measure: typeof measure; renderStill: typeof renderStill };
  }
}

window.__shaderClips = shaderClips;
window.__shaderFx = { measure, renderStill };
