import type { BrandTokens } from '../brand';
import type { MotionDoc } from '../doc';
import { FullBackend } from './backends';
import { mountPlayer, type Player } from './play';
import { GPU_PLAYER_TAG, GPU_SOURCE_ATTR } from './player-tag';
import { Target, composeHtml } from '../hyperframes/compose';
import { RuntimeDelivery } from '../hyperframes/runtime-delivery';
import { Liveness } from '../interactive/settings';


export type GpuSource = { doc: MotionDoc; tokens: BrandTokens; assets: Record<string, string> };

const BACKEND_ORDER = [FullBackend.Core, FullBackend.CoreGl];

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

  disconnectedCallback() {
    cancelAnimationFrame(this.clock);
    this.player?.dispose();
  }

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
    this.player = mountPlayer({ canvas, host, backend, size: { width: source.doc.width, height: source.doc.height }, time: () => this.currentTime, onfallback: (reason) => this.fallback(reason) });
    this.fitCanvas();
    const origin = new URL(import.meta.url).origin;
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
