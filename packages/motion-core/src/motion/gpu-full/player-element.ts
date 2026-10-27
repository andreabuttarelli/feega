import type { BrandTokens } from '../brand';
import type { MotionDoc } from '../doc';
import { FullBackend } from './backends';
import { mountPlayer, type Player } from './play';
import { GPU_PLAYER_TAG, GPU_SOURCE_ATTR } from './player-tag';
import { Target, composeHtml } from '../hyperframes/compose';
import { RuntimeDelivery } from '../hyperframes/runtime-delivery';
import { Liveness, interactiveOf } from '../interactive/settings';
import { InputKey, type InputValues } from '../expression/inputs';
import type { LiveInputs } from '../interactive/gpu-live';
import { coerceVars, type VarValues } from '../interactive/var-model';
import { contentBox, fitOf, unit } from './pointer';
import { inlineCore } from './inline-core';


export type GpuSource = { doc: MotionDoc; tokens: BrandTokens; assets: Record<string, string> };

const BACKEND_ORDER = [FullBackend.Core, FullBackend.CoreGl];

export type Drive = { values?: Partial<Record<InputKey, number | undefined>>; vars?: VarValues };

const MS_PER_SECOND = 1000;

export const durationOf = (doc: MotionDoc) => doc.durationInFrames / doc.fps;

export class GpuPlayerElement extends HTMLElement {
  static observedAttributes = ['srcdoc', 'fit'];

  currentTime = 0;
  private playing = false;
  private startedAt = 0;
  private source: GpuSource | null = null;
  private player: Player | null = null;
  private clock = 0;
  private tried = 0;
  private announced = false;
  private born = performance.now();
  private touched: InputValues = {};
  private driven: InputValues = {};
  private variables: VarValues = {};

  get duration(): number {
    return this.source ? durationOf(this.source.doc) : 0;
  }

  attributeChangedCallback(name: string) {
    if (name === 'fit') {
      this.fitCanvas();
      return;
    }
    const tag = document.getElementById(this.getAttribute(GPU_SOURCE_ATTR) ?? '');
    this.load(tag ? (JSON.parse(tag.textContent ?? 'null') as GpuSource) : null);
  }

  load(source: GpuSource | null) {
    this.source = source;
    this.mount();
  }

  private fitCanvas() {
    const canvas = this.querySelector('canvas');
    if (canvas) {
      canvas.style.objectFit = this.getAttribute('fit') ?? 'fill';
    }
  }

  connectedCallback() {
    this.addEventListener('pointermove', this.touch);
    this.addEventListener('pointerdown', this.press);
    this.addEventListener('pointerup', this.release);
    this.addEventListener('pointerleave', this.leave);
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.clock);
    this.player?.dispose();
    this.removeEventListener('pointermove', this.touch);
    this.removeEventListener('pointerdown', this.press);
    this.removeEventListener('pointerup', this.release);
    this.removeEventListener('pointerleave', this.leave);
  }

  drive(next: Drive) {
    if (next.values) {
      this.driven = Object.fromEntries(Object.entries({ ...this.driven, ...next.values }).filter(([, v]) => v !== undefined));
    }
    if (!next.vars || !this.source) {
      return;
    }
    const given = coerceVars(interactiveOf(this.source.doc).vars, next.vars);
    if (!Object.keys(given).length) {
      return;
    }
    this.variables = { ...this.variables, ...given };
    this.dispatchEvent(new CustomEvent('varschange', { detail: { values: this.variables } }));
  }

  linkAt(x: number, y: number): string | null {
    const doc = this.source?.doc;
    return doc && this.player ? this.player.linkAt([x * doc.width, y * doc.height]) : null;
  }

  clipAt(x: number, y: number): string | null {
    const doc = this.source?.doc;
    return doc && this.player ? this.player.clipAt([x * doc.width, y * doc.height]) : null;
  }

  private live = (): LiveInputs => ({ values: { [InputKey.Time]: (performance.now() - this.born) / MS_PER_SECOND, ...this.touched, ...this.driven }, vars: this.variables });

  private unitOf(e: PointerEvent): [number, number] {
    const canvas = this.querySelector('canvas');
    const doc = this.source?.doc;
    if (!canvas || !doc) {
      return [0, 0];
    }
    const r = canvas.getBoundingClientRect();
    return unit(contentBox({ left: r.left, top: r.top, width: r.width, height: r.height }, doc.width / doc.height, fitOf(this.getAttribute('fit'))), e.clientX, e.clientY);
  }

  private touch = (e: PointerEvent) => {
    const [x, y] = this.unitOf(e);
    this.touched = { ...this.touched, [InputKey.PointerX]: x, [InputKey.PointerY]: y, [InputKey.Hover]: 1 };
    this.style.cursor = this.linkAt(x, y) ? 'pointer' : '';
  };

  private press = (e: PointerEvent) => {
    this.touch(e);
    this.touched = { ...this.touched, [InputKey.PointerDown]: 1 };
  };

  private release = (e: PointerEvent) => {
    this.touch(e);
    this.touched = { ...this.touched, [InputKey.PointerDown]: 0 };
    const url = this.linkAt(...this.unitOf(e));
    if (url && this.dispatchEvent(new CustomEvent('link', { detail: { url }, cancelable: true }))) {
      window.open(url, '_blank', 'noopener');
    }
  };

  private leave = () => {
    const { [InputKey.PointerX]: _x, [InputKey.PointerY]: _y, ...rest } = this.touched;
    this.touched = { ...rest, [InputKey.Hover]: 0, [InputKey.PointerDown]: 0 };
    this.style.cursor = '';
  };

  play() {
    if (this.playing) {
      return;
    }
    if (this.currentTime >= this.duration) {
      this.currentTime = 0;
    }
    this.playing = true;
    this.startedAt = performance.now() - this.currentTime * 1000;
    this.dispatchEvent(new Event('play'));
    this.clock = requestAnimationFrame(this.tick);
  }

  pause() {
    if (!this.playing) {
      return;
    }
    this.playing = false;
    cancelAnimationFrame(this.clock);
    this.dispatchEvent(new Event('pause'));
  }

  seek(time: number) {
    this.currentTime = Math.max(0, Math.min(time, this.duration));
    this.startedAt = performance.now() - this.currentTime * 1000;
    this.timeUpdate();
  }

  private tick = () => {
    this.currentTime = Math.min((performance.now() - this.startedAt) / 1000, this.duration);
    this.timeUpdate();
    if (this.currentTime < this.duration) {
      this.clock = requestAnimationFrame(this.tick);
      return;
    }
    this.playing = false;
    this.dispatchEvent(new Event('ended'));
  };

  private timeUpdate() {
    this.dispatchEvent(new CustomEvent('timeupdate', { detail: { currentTime: this.currentTime } }));
  }

  private mount() {
    const source = this.source;
    this.player?.dispose();
    this.replaceChildren();
    if (!source) {
      return;
    }
    const host = Object.assign(document.createElement('div'), { ariaHidden: 'true' });
    Object.assign(host.style, { position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none' });
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
    this.append(host, canvas);
    const backend = BACKEND_ORDER[this.tried];
    this.player = mountPlayer({ canvas, host, backend, size: { width: source.doc.width, height: source.doc.height }, time: () => this.currentTime, onfallback: (reason) => this.fallback(reason), inputs: this.live });
    this.fitCanvas();
    const origin = inlineCore()?.origin ?? new URL(import.meta.url).origin;
    this.player.show({ ...source, compose: (only) => composeHtml({ ...source, liveness: Liveness.Baked, target: Target.Screen, origin, runtime: RuntimeDelivery.Hosted, only }) });
    if (!this.announced) {
      this.announced = true;
      queueMicrotask(() => this.dispatchEvent(new Event('ready')));
    }
  }

  private fallback(reason: unknown) {
    this.tried += 1;
    if (this.tried < BACKEND_ORDER.length) {
      this.mount();
      return;
    }
    this.dispatchEvent(new CustomEvent('playbackerror', { detail: { error: { message: String(reason) } } }));
  }
}

export function defineGpuPlayer() {
  if (!customElements.get(GPU_PLAYER_TAG)) {
    customElements.define(GPU_PLAYER_TAG, GpuPlayerElement);
  }
}
