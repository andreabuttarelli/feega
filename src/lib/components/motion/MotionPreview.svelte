<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { FPS } from '$lib/motion/design';
  import { CAPTURE_REPLY, FrameFormat, type CaptureReply, type ClipError } from '$lib/motion/hyperframes/capture';
  import { previewDriver, type ShotRequest } from '$lib/motion/hyperframes/preview-driver';

  type Player = HTMLElement & { seek: (t: number) => void; play: () => void; pause: () => void; currentTime: number; iframeElement: HTMLIFrameElement };

  export type CapturedFrame = { time: number; data: string; layout: string; errors: ClipError[] };
  export type FrameSize = { width: number; height: number };

  const RELOAD_DEBOUNCE_MS = 250;
  const CAPTURE_WIDTH = 640;
  const CAPTURE_QUALITY = 0.72;

  let {
    html,
    width,
    height,
    frame = $bindable(0),
    playing = $bindable(false),
    children
  }: { html: string; width: number; height: number; frame?: number; playing?: boolean; children?: Snippet } = $props();

  let host = $state<HTMLDivElement | null>(null);
  let player: Player | null = null;
  let reported = -1;
  let ready = false;
  let pending: ReturnType<typeof setTimeout> | null = null;
  let capturing = false;

  function setSource(next: string) {
    if (!player) {
      return;
    }
    ready = false;
    player.setAttribute('srcdoc', next);
  }

  onMount(() => {
    let disposed = false;
    void import('@hyperframes/player').then(() => {
      if (disposed || !host) {
        return;
      }
      const el = document.createElement('hyperframes-player') as Player;
      el.setAttribute('sandbox-origin', 'opaque');
      el.setAttribute('assets-loading-ui', 'none');
      el.setAttribute('disable-click-to-play', '');
      el.style.width = '100%';
      el.style.height = '100%';
      el.addEventListener('ready', () => {
        ready = true;
        el.seek(frame / FPS);
      });
      el.addEventListener('timeupdate', (e) => {
        if (!playing) {
          return;
        }
        const next = Math.round(((e as CustomEvent<{ currentTime: number }>).detail.currentTime ?? 0) * FPS);
        reported = next;
        frame = next;
      });
      el.addEventListener('play', () => (playing = true));
      el.addEventListener('pause', () => (playing = false));
      el.addEventListener('ended', () => (playing = false));
      host.appendChild(el);
      player = el;
      driver.load(html);
    });
    return () => {
      disposed = true;
      player?.remove();
      player = null;
    };
  });

  const driver = previewDriver({
    load: setSource,
    seek: (t) => player?.seek(t),
    post: (message) => {
      const target = player?.iframeElement?.contentWindow;
      if (!target) {
        return false;
      }
      target.postMessage(message, '*');
      return true;
    },
    onReady: (listener) => {
      const el = player;
      el?.addEventListener('ready', listener);
      return () => el?.removeEventListener('ready', listener);
    },
    onReply: (listener) => {
      const onMessage = (e: MessageEvent) => {
        const m = e.data as CaptureReply;
        if (e.source !== player?.iframeElement?.contentWindow || m?.type !== CAPTURE_REPLY) {
          return;
        }
        listener(m);
      };
      window.addEventListener('message', onMessage);
      return () => window.removeEventListener('message', onMessage);
    }
  });

  const shoot = (time: number, request: ShotRequest) => driver.shoot(time, request);
  const loaded = (next: string) => driver.loaded(next);

  function borrowed<T>(source: string, work: () => Promise<T>): Promise<T> {
    return driver.exclusive(() => swapped(source, work));
  }

  async function swapped<T>(source: string, work: () => Promise<T>): Promise<T> {
    playing = false;
    const back = frame;
    capturing = true;
    try {
      await loaded(source);
      return await work();
    } finally {
      capturing = false;
      await loaded(html);
      player?.seek(back / FPS);
    }
  }

  export function capture(times: number[], source: string, captureWidth = CAPTURE_WIDTH): Promise<CapturedFrame[]> {
    const request = { format: FrameFormat.Jpeg, width: captureWidth, height: Math.round((captureWidth * height) / width), quality: CAPTURE_QUALITY };
    return borrowed(source, async () => {
      const frames: CapturedFrame[] = [];
      for (const time of times) {
        const reply = await shoot(time, request);
        frames.push({ time, data: reply.url ?? '', layout: reply.layout ?? '', errors: reply.errors ?? [] });
      }
      return frames;
    });
  }

  export function render(times: number[], size: FrameSize, onFrame: (bitmap: ImageBitmap, index: number) => Promise<void>, signal: AbortSignal): Promise<void> {
    return borrowed(html, async () => {
      for (const [index, time] of times.entries()) {
        signal.throwIfAborted();
        const reply = await shoot(time, { format: FrameFormat.Bitmap, ...size });
        if (!reply.bitmap) {
          throw new Error('frame not rendered');
        }
        await onFrame(reply.bitmap, index);
      }
    });
  }

  $effect(() => {
    const next = html;
    if (pending) {
      clearTimeout(pending);
    }
    pending = setTimeout(() => {
      if (!capturing) {
        driver.load(next);
      }
    }, RELOAD_DEBOUNCE_MS);
  });

  $effect(() => {
    const target = frame;
    if (!player || !ready || playing || target === reported) {
      return;
    }
    reported = target;
    player.seek(target / FPS);
  });

  $effect(() => {
    if (!player || !ready) {
      return;
    }
    if (playing) {
      player.play();
    } else {
      player.pause();
    }
  });
</script>

<div class="stage" style={`aspect-ratio: ${width} / ${height}; width: min(100cqw, calc(100cqh * ${width / height}));`} data-testid="motion-preview">
  <div class="host" bind:this={host}></div>
  {@render children?.()}
</div>

<style>
  .stage {
    position: relative;
    background: #000;
    outline: 1px solid var(--line);
  }

  .host {
    position: absolute;
    inset: 0;
  }
</style>
