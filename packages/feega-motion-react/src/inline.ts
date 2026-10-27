import { EMBED_ROUTE, HostCommand, SCRUB_PLAYBACK, type HostMessage, type ReadyInfo } from './protocol.js';

export const GPU_PLAYER_TAG = 'feega-gpu-player';
export const AUTOPLAY_PLAYBACK = 'autoplay';
export const IN_VIEW_PLAYBACK = 'in-view';

export const playerModuleUrl = (origin: string) => `${origin}/motion-player.js`;
export const sourceUrl = (origin: string, id: string) => `${origin}${EMBED_ROUTE}/${encodeURIComponent(id)}/source.json`;

export type GpuSource = { doc: { width: number; height: number; fps: number; durationInFrames: number }; playback: string; loop: boolean; scrollLength: number };

export type GpuElement = HTMLElement & { load: (source: GpuSource) => void; play: () => void; pause: () => void; seek: (seconds: number) => void; duration: number; currentTime: number };

export const isGpuSource = (value: unknown): value is GpuSource => typeof (value as GpuSource | null)?.doc?.durationInFrames === 'number';

export const durationOf = (source: GpuSource) => source.doc.durationInFrames / source.doc.fps;

export const readyOf = (source: GpuSource): ReadyInfo => ({ width: source.doc.width, height: source.doc.height, duration: durationOf(source), playback: source.playback, loop: source.loop, vars: [], values: {} });

const COMMANDS: Record<HostCommand, (el: GpuElement, time?: number) => void> = {
  [HostCommand.Play]: (el) => el.play(),
  [HostCommand.Pause]: (el) => el.pause(),
  [HostCommand.Seek]: (el, time) => el.seek(time ?? 0)
};

export function driveInline(el: GpuElement, source: GpuSource, m: Omit<HostMessage, 'type'>) {
  if (m.command) {
    COMMANDS[m.command](el, m.time);
  }
  if (m.progress !== undefined && source.playback === SCRUB_PLAYBACK) {
    el.seek(m.progress * durationOf(source));
  }
  if (m.visible !== undefined && source.playback === IN_VIEW_PLAYBACK) {
    (m.visible ? el.play : el.pause).call(el);
  }
  if (m.fit) {
    el.setAttribute('fit', m.fit);
  }
}

export const startsAlone = (source: GpuSource, reducedMotion: boolean) => source.playback === AUTOPLAY_PLAYBACK && !reducedMotion;

export const loopsAfterEnd = (source: GpuSource) => source.loop && source.playback !== SCRUB_PLAYBACK;
