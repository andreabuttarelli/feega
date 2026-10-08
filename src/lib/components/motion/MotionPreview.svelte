<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { FPS } from '$lib/motion/design';
  import { CAPTURE_REPLY, FrameFormat, type CaptureReply, type ClipError } from '$lib/motion/hyperframes/capture';
  import { Playback, previewDriver, type ShotRequest } from '$lib/motion/hyperframes/preview-driver';
  import { mountCapturePlayer } from '$lib/motion/hyperframes/capture-player';
  import { shootInLanes } from '$lib/motion/export/lanes';
  import { CAPTURE_PROFILES, CaptureProfile } from '$lib/motion/export/capture-profile';
  import { MEASURE_REPLY, MEASURE_REQUEST, type MeasureReply, type MeasuredBox } from '$lib/motion/hyperframes/measure';
  import { InputKey, type InputValues } from '$lib/motion/expression/inputs';
  import { INPUT_MESSAGE } from '$lib/motion/interactive/runtime';

  type Player = HTMLElement & { seek: (t: number) => void; play: () => void; pause: () => void; currentTime: number; muted: boolean; loop: boolean; iframeElement: HTMLIFrameElement };

  export type CapturedFrame = { time: number; data: string; layout: string; errors: ClipError[] };
  export type FrameSize = { width: number; height: number };

  const CAPTURE_WIDTH = 640;
  const CAPTURE_QUALITY = 0.72;
  const MEASURE_TIMEOUT_MS = 1000;

  let {
    html,
    width,
    height,
    fps = FPS,
    frame = $bindable(0),
    playing = $bindable(false),
    muted = false,
    loop = false,
    live = null,
    children
  }: { html: string; width: number; height: number; fps?: number; frame?: number; playing?: boolean; muted?: boolean; loop?: boolean; live?: InputValues | null; children?: Snippet } = $props();

  let pointer = $state<InputValues>({});

  function sendInputs(values: InputValues) {
    player?.iframeElement?.contentWindow?.postMessage({ type: INPUT_MESSAGE, values }, '*');
  }

  function track(e: PointerEvent) {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    pointer = { ...pointer, [InputKey.PointerX]: (e.clientX - box.left) / box.width, [InputKey.PointerY]: (e.clientY - box.top) / box.height, [InputKey.Hover]: 1 };
  }

  $effect(() => {
    if (live) {
      sendInputs({ ...live, ...pointer });
    }
  });

  let host = $state<HTMLDivElement | null>(null);
  let player: Player | null = null;
  let reported = -1;
  let ready = false;
  let pending: number | null = null;
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
      el.muted = muted;
      el.loop = loop;
      el.addEventListener('ready', () => {
        ready = true;
        el.seek(frame / fps);
        driver.ready();
      });
      el.addEventListener('timeupdate', (e) => {
        if (!playing) {
          return;
        }
        const next = Math.round(((e as CustomEvent<{ currentTime: number }>).detail.currentTime ?? 0) * fps);
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
    play: () => player?.play(),
    pause: () => player?.pause(),
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
      player?.seek(back / fps);
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

  export function still(time: number, captureWidth = CAPTURE_WIDTH): Promise<string> {
    const request = { format: FrameFormat.Jpeg, width: captureWidth, height: Math.round((captureWidth * height) / width), quality: CAPTURE_QUALITY };
    return driver.exclusive(async () => (await shoot(time, request)).url ?? '');
  }

  export function measure(): Promise<Record<string, MeasuredBox>> {
    const target = player?.iframeElement?.contentWindow;
    if (!target || capturing) {
      return Promise.resolve({});
    }
    const id = crypto.randomUUID();
    return new Promise((resolve) => {
      const settle = (boxes: Record<string, MeasuredBox>) => {
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(boxes);
      };
      const onMessage = (e: MessageEvent) => {
        const m = e.data as MeasureReply;
        if (e.source !== target || m?.type !== MEASURE_REPLY || m.id !== id) {
          return;
        }
        settle(m.boxes);
      };
      const timer = setTimeout(() => settle({}), MEASURE_TIMEOUT_MS);
      window.addEventListener('message', onMessage);
      target.postMessage({ type: MEASURE_REQUEST, id }, '*');
    });
  }

  export function render(times: number[], size: FrameSize, onFrame: (bitmap: ImageBitmap, index: number) => Promise<void>, signal: AbortSignal, source: string = html, profile: CaptureProfile = CaptureProfile.Fast): Promise<void> {
    const { settle, lanes } = CAPTURE_PROFILES[profile];
    const request = { format: FrameFormat.Bitmap, settle, ...size };
    const bitmapOf = (reply: CaptureReply) => {
      if (!reply.bitmap) {
        throw new Error('frame not rendered');
      }
      return reply.bitmap;
    };
    return borrowed(source, async () => {
      const extra = host ? await Promise.all(Array.from({ length: lanes() - 1 }, () => mountCapturePlayer(host!, source))) : [];
      try {
        const shooters = [(time: number) => shoot(time, request).then(bitmapOf), ...extra.map((p) => (time: number) => p.shoot(time, request).then(bitmapOf))];
        await shootInLanes(times, shooters, onFrame, signal);
      } finally {
        extra.forEach((p) => p.dispose());
      }
    });
  }

  $effect(() => {
    const next = html;
    if (pending) {
      cancelAnimationFrame(pending);
    }
    pending = requestAnimationFrame(() => {
      if (!capturing) {
        driver.update(next);
      }
    });
  });

  $effect(() => {
    const target = frame;
    if (!player || !ready || playing || target === reported) {
      return;
    }
    reported = target;
    player.seek(target / fps);
  });

  $effect(() => {
    const sound = muted;
    const again = loop;
    if (player) {
      player.muted = sound;
      player.loop = again;
    }
  });

  $effect(() => {
    driver.playback(playing ? Playback.Playing : Playback.Paused);
  });
</script>

<div class="stage" style={`aspect-ratio: ${width} / ${height}; width: var(--preview-w, min(100cqw, calc(100cqh * ${width / height})));`} data-testid="motion-preview">
  <div class="host" bind:this={host}></div>
  {@render children?.()}
  {#if live}
    <div
      class="live-pad"
      role="presentation"
      data-testid="interactive-pad"
      onpointermove={track}
      onpointerdown={(e) => {
        track(e);
        pointer = { ...pointer, [InputKey.PointerDown]: 1 };
      }}
      onpointerup={() => (pointer = { ...pointer, [InputKey.PointerDown]: 0 })}
      onpointerleave={() => (pointer = {})}
    ></div>
  {/if}
</div>

<style>
  .stage {
    position: relative;
    flex-shrink: 0;
    background: #000;
    outline: 1px solid var(--ui-line);
  }

  .host {
    position: absolute;
    inset: 0;
  }

  .live-pad {
    position: absolute;
    inset: 0;
    cursor: crosshair;
    touch-action: none;
  }
</style>
