import { hotPatch, type HotPatch } from './hot';
import { CAPTURE_REQUEST, stampOf, type CaptureReply, type CaptureRequest } from './capture';

export const CAPTURE_TIMEOUT_MS = 15_000;
export const STALE_RETRY_MS = 50;
export const RELOAD_DEBOUNCE_MS = 250;

export enum Playback {
  Playing = 'playing',
  Paused = 'paused'
}

export type PlayerPort = {
  load: (html: string) => void;
  seek: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  post: (message: CaptureRequest | HotPatch) => boolean;
  onReady: (listener: () => void) => () => void;
  onReply: (listener: (reply: CaptureReply) => void) => () => void;
};

export type ShotRequest = Omit<CaptureRequest, 'type' | 'id'>;

export type PreviewDriver = {
  load: (html: string) => void;
  update: (html: string) => void;
  loaded: (html: string) => Promise<void>;
  shoot: (time: number, request: ShotRequest) => Promise<CaptureReply>;
  exclusive: <T>(work: () => Promise<T>) => Promise<T>;
  ready: () => void;
  playback: (next: Playback) => void;
};

export function previewDriver(port: PlayerPort, newId: () => string = () => crypto.randomUUID(), timeoutMs = CAPTURE_TIMEOUT_MS): PreviewDriver {
  let expected: string | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  let wanted = Playback.Paused;
  let live = false;
  let current = '';

  function load(html: string) {
    expected = stampOf(html);
    live = false;
    current = html;
    port.load(html);
  }

  let reload: ReturnType<typeof setTimeout> | null = null;

  function update(html: string) {
    if (reload) {
      clearTimeout(reload);
      reload = null;
    }
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
    apply();
  }

  function playback(next: Playback) {
    wanted = next;
    apply();
  }

  function loaded(html: string): Promise<void> {
    return new Promise((resolve) => {
      const off = port.onReady(() => {
        off();
        resolve();
      });
      load(html);
    });
  }

  function shoot(time: number, request: ShotRequest): Promise<CaptureReply> {
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
        port.seek(time);
        if (!port.post(message)) {
          done(() => reject(new Error('preview not ready')));
        }
      };
      const timer = setTimeout(() => done(() => reject(new Error('capture timed out'))), timeoutMs);
      const off = port.onReply((m) => {
        if (m.id !== id) {
          return;
        }
        if (expected && m.stamp !== expected) {
          retry = setTimeout(send, STALE_RETRY_MS);
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

  return { load, update, loaded, shoot, exclusive, ready, playback };
}
