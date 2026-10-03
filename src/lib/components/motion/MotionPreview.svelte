<script lang="ts">
  import { onMount } from 'svelte';
  import { FPS } from '$lib/motion/design';
  import { CAPTURE_REPLY, CAPTURE_REQUEST } from '$lib/motion/hyperframes/compose';

  type Player = HTMLElement & { seek: (t: number) => void; play: () => void; pause: () => void; currentTime: number; iframeElement: HTMLIFrameElement };

  export type CapturedFrame = { time: number; data: string };

  const RELOAD_DEBOUNCE_MS = 250;
  const CAPTURE_WIDTH = 640;
  const CAPTURE_QUALITY = 0.72;
  const CAPTURE_TIMEOUT_MS = 15_000;

  let {
    html,
    width,
    height,
    frame = $bindable(0),
    playing = $bindable(false)
  }: { html: string; width: number; height: number; frame?: number; playing?: boolean } = $props();

  let host = $state<HTMLDivElement | null>(null);
  let player: Player | null = null;
  let reported = -1;
  let ready = false;
  let pending: ReturnType<typeof setTimeout> | null = null;
  let capturing = false;

  function load(next: string) {
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
      load(html);
    });
    return () => {
      disposed = true;
      player?.remove();
      player = null;
    };
  });

  function captureOne(time: number): Promise<string> {
    const target = player?.iframeElement?.contentWindow;
    if (!player || !target) {
      return Promise.reject(new Error('preview not ready'));
    }
    const id = crypto.randomUUID();
    player.seek(time);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => done(() => reject(new Error('capture timed out'))), CAPTURE_TIMEOUT_MS);
      const onMessage = (e: MessageEvent) => {
        const m = e.data as { type?: string; id?: string; url?: string; error?: string };
        if (e.source !== target || m?.type !== CAPTURE_REPLY || m.id !== id) {
          return;
        }
        done(() => (m.url ? resolve(m.url) : reject(new Error(m.error ?? 'capture failed'))));
      };
      const done = (settle: () => void) => {
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        settle();
      };
      window.addEventListener('message', onMessage);
      target.postMessage({ type: CAPTURE_REQUEST, id, width: CAPTURE_WIDTH, quality: CAPTURE_QUALITY }, '*');
    });
  }

  function loaded(next: string): Promise<void> {
    return new Promise((resolve) => {
      player?.addEventListener('ready', () => resolve(), { once: true });
      load(next);
    });
  }

  export async function capture(times: number[], source: string): Promise<CapturedFrame[]> {
    playing = false;
    const back = frame;
    capturing = true;
    try {
      await loaded(source);
      const frames: CapturedFrame[] = [];
      for (const time of times) {
        frames.push({ time, data: await captureOne(time) });
      }
      return frames;
    } finally {
      capturing = false;
      await loaded(html);
      player?.seek(back / FPS);
    }
  }

  $effect(() => {
    const next = html;
    if (pending) {
      clearTimeout(pending);
    }
    pending = setTimeout(() => {
      if (!capturing) {
        load(next);
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
