import { hotPatch, type HotPatch } from './hot';
import { CAPTURE_REQUEST, stampOf, type CaptureReply, type CaptureRequest } from './capture';
import { exactSeek, type ExactSeek } from './exact-seek';

export const CAPTURE_TIMEOUT_MS = 15_000;
export const STALE_RETRY_MS = 50;
export const RELOAD_DEBOUNCE_MS = 250;
const SEEK_TOLERANCE_S = 1 / 240;

export enum Playback {
  Playing = 'playing',
  Paused = 'paused'
}

export type PlayerPort = {
  load: (html: string) => void;
  seek: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  post: (message: CaptureRequest | HotPatch | ExactSeek) => boolean;
  onReady: (listener: () => void) => () => void;
  onReply: (listener: (reply: CaptureReply) => void) => () => void;
};

export type ShotRequest = Omit<CaptureRequest, 'type' | 'id'>;

export type PreviewDriver = {
  load: (html: string) => void;
  update: (html: string) => void;
  loaded: (html: string) => Promise<void>;
  seek: (seconds: number) => void;
  shoot: (time: number, request: ShotRequest, waitMs?: number) => Promise<CaptureReply>;
  exclusive: <T>(work: () => Promise<T>) => Promise<T>;
  whenLive: () => Promise<void>;
  ready: () => void;
  playback: (next: Playback) => void;
};

export function previewDriver(port: PlayerPort, newId: () => string = () => crypto.randomUUID(), timeoutMs = CAPTURE_TIMEOUT_MS): PreviewDriver {
  let expected: string | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  let wanted = Playback.Paused;
  let live = false;
  let current = '';
  let markLive = () => {};
  const firstLive = new Promise<void>((resolve) => (markLive = resolve));

  let reload: ReturnType<typeof setTimeout> | null = null;

  function cancelReload() {
    if (reload) {
      clearTimeout(reload);
      reload = null;
    }
  }

  function load(html: string) {
    cancelReload();
    expected = stampOf(html);
    live = false;
    current = html;
    port.load(html);
  }

  function update(html: string) {
    cancelReload();
    if (html === current) {
      return;
    }
    const patch = live ? hotPatch(current, html) : null;
    if (patch && port.post(patch)) {
      current = html;
      return;
    }
    reload = setTimeout(() => {
      reload = null;
      load(html);
    }, RELOAD_DEBOUNCE_MS);
  }

  function apply() {
    if (!live) {
      return;
    }
    if (wanted === Playback.Playing) {
      port.play();
      return;
    }
    port.pause();
  }

  function ready() {
    live = true;
    markLive();
    apply();
  }

  function playback(next: Playback) {
    wanted = next;
    apply();
  }

  function loaded(html: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error('preview never became ready'));
      }, timeoutMs);
      const off = port.onReady(() => {
        clearTimeout(timer);
        off();
        resolve();
      });
      load(html);
    });
  }

  function seek(seconds: number) {
    port.seek(seconds);
    port.post(exactSeek(seconds));
  }

  function shoot(time: number, request: ShotRequest, waitMs = timeoutMs): Promise<CaptureReply> {
    const id = newId();
    const message = { type: CAPTURE_REQUEST, id, ...request } as const;
    let retry: ReturnType<typeof setTimeout> | null = null;

    return new Promise((resolve, reject) => {
      const done = (settle: () => void) => {
        clearTimeout(timer);
        if (retry) {
          clearTimeout(retry);
        }
        off();
        settle();
      };
      const send = () => {
        seek(time);
        if (!port.post(message)) {
          done(() => reject(new Error('preview not ready')));
        }
      };
      const timer = setTimeout(() => done(() => reject(new Error(`the frame at ${time.toFixed(2)}s did not draw within ${Math.round(waitMs / 1000)}s`))), waitMs);
      const off = port.onReply((m) => {
        if (m.id !== id) {
          return;
        }
        if (expected && m.stamp !== expected) {
          retry = setTimeout(send, STALE_RETRY_MS);
          return;
        }
        if (m.time !== undefined && Math.abs(m.time - time) > SEEK_TOLERANCE_S) {
          send();
          return;
        }
        done(() => (m.error ? reject(new Error(m.error)) : resolve(m)));
      });
      send();
    });
  }

  function exclusive<T>(work: () => Promise<T>): Promise<T> {
    const run = queue.then(work, work);
    queue = run.catch(() => {});
    return run;
  }

  return { load, update, loaded, seek, shoot, exclusive, whenLive: () => firstLive, ready, playback };
}
