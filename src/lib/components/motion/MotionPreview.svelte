<script lang="ts">
  import { Background } from '$lib/motion/doc';
  import { onMount, type Snippet } from 'svelte';
  import { FPS } from '$lib/motion/design';
  import { CAPTURE_REPLY, FrameFormat, type CaptureReply, type ClipError } from '$lib/motion/hyperframes/capture';
  import { CAPTURE_TIMEOUT_MS, Playback, previewDriver, type ShotRequest } from '$lib/motion/hyperframes/preview-driver';
  import { mountCapturePlayer } from '$lib/motion/hyperframes/capture-player';
  import { crispFor } from '$lib/motion/hyperframes/crisp-scale';
  import { listenTap, type FramePoint } from '$lib/motion/hyperframes/frame-tap';
  import { laneVisibility, shootInLanes } from '$lib/motion/export/lanes';
  import { engineOf } from '$lib/motion/engine';
  import { lanesWithin, webglPerLane } from '$lib/motion/export/webgl-budget';
  import { exportLayering, frameOf } from '$lib/motion/export/webgl-device';
  import { CAPTURE_PROFILES, CaptureProfile } from '$lib/motion/export/capture-profile';
  import { DRAWN_EVENT, DRAWN_FALLBACK_MS, REDRAWN, MEASURE_REPLY, MEASURE_REQUEST, Pose, type MeasureReply, type MeasuredBox } from '$lib/motion/hyperframes/measure';
  import { InputKey, type InputValues } from '$lib/motion/expression/inputs';
  import { INPUT_MESSAGE } from '$lib/motion/interactive/runtime';
  import type { VarValues } from '$lib/motion/interactive/var-model';
  import { RenderEngine } from '$lib/motion/gpu/engine-flag';
  import { EditEnd, TEXT_EDIT, type TextEditMessage } from '$lib/motion/hyperframes/text-edit';
  import GpuLayer from './GpuLayer.svelte';
  import GpuFullLayer from './GpuFullLayer.svelte';
  import { FullBackend } from '$lib/motion/gpu-full/backends';
  import type { BrandTokens } from '$lib/motion/brand';
  import type { MotionDoc } from '$lib/motion/doc';
  import { previewHtml } from '$lib/canvas/gpu/memory-budget';
  import type { Compose } from '$lib/motion/gpu/engine';

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
    vars = null,
    redraws = $bindable(0),
    ontap = null,
    background = Background.Brand,
    engine = RenderEngine.Html,
    gpuCompose = null,
    fullDoc = null,
    children
  }: { html: string; width: number; height: number; fps?: number; frame?: number; playing?: boolean; muted?: boolean; loop?: boolean; live?: InputValues | null; vars?: VarValues | null; redraws?: number; ontap?: ((at: FramePoint) => void) | null; background?: Background; engine?: RenderEngine; gpuCompose?: Compose | null; fullDoc?: { doc: MotionDoc; tokens: BrandTokens; assets: Record<string, string> } | null; children?: Snippet } = $props();

  const DRAWN_OVER: ReadonlySet<RenderEngine> = new Set([RenderEngine.Gpu, RenderEngine.GpuFull, RenderEngine.GpuCore]);

  const FULL_ENGINES: ReadonlySet<RenderEngine> = new Set([RenderEngine.GpuFull, RenderEngine.GpuCore]);

  let pointer = $state<InputValues>({});
  let exportedOn = $state<RenderEngine | null>(null);

  function sendInputs(values: InputValues) {
    player?.iframeElement?.contentWindow?.postMessage({ type: INPUT_MESSAGE, values, ...(vars ? { vars } : {}) }, '*');
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
  let shown = $state<HTMLIFrameElement | null>(null);
  const PLAYER_BACKDROP: Record<Background, string> = { [Background.Brand]: '', [Background.Transparent]: 'transparent' };

  let player: Player | null = null;
  let reported = -1;
  let ready = false;
  let readyWaiters: (() => void)[] = [];
  const READY_WAIT_MS = 5000;

  function whenReady(): Promise<boolean> {
    if (ready) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), READY_WAIT_MS);
      readyWaiters.push(() => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  }
  let pending: number | null = null;
  let capturing = false;
  let drawnDue: ReturnType<typeof setTimeout> | null = null;

  function setSource(next: string) {
    if (!player) {
      return;
    }
    ready = false;
    player.setAttribute('srcdoc', previewHtml(next, { width, height }));
  }

  function announceDrawn() {
    if (drawnDue === null) {
      return;
    }
    clearTimeout(drawnDue);
    drawnDue = null;
    host?.dispatchEvent(new CustomEvent(DRAWN_EVENT, { bubbles: true }));
  }

  function redrawn(e: MessageEvent) {
    if (e.source === player?.iframeElement?.contentWindow && e.data?.type === REDRAWN) {
      redraws++;
      announceDrawn();
    }
  }

  onMount(() => {
    let disposed = false;
    let crisp = () => {};
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
      el.style.background = PLAYER_BACKDROP[background];
      el.style.opacity = DRAWN_OVER.has(engine) ? '0' : '';
      el.muted = muted;
      el.loop = loop;
      el.addEventListener('ready', () => {
        crisp();
        shown = el.iframeElement;
        crisp = shown ? crispFor(engineOf(navigator.userAgent), shown) : () => {};
        ready = true;
        const waiting = readyWaiters;
        readyWaiters = [];
        waiting.forEach((wake) => wake());
        drawnDue = setTimeout(announceDrawn, frame === 0 ? 0 : DRAWN_FALLBACK_MS);
        driver.seek(frame / fps);
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
      clearTimeout(drawnDue ?? undefined);
      crisp();
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

  const shoot = (time: number, request: ShotRequest, waitMs?: number) => driver.shoot(time, request, waitMs);
  const loaded = (next: string) => driver.loaded(next);

  function borrowed<T>(source: string, work: () => Promise<T>): Promise<T> {
    return driver.exclusive(() => swapped(source, work));
  }

  async function swapped<T>(source: string, work: () => Promise<T>): Promise<T> {
    playing = false;
    const back = frame;
    capturing = true;
    if (player) {
      player.style.visibility = laneVisibility(engineOf(navigator.userAgent));
    }
    try {
      await loaded(source);
      return await work();
    } finally {
      capturing = false;
      if (player) {
        player.style.visibility = 'visible';
      }
      await loaded(html);
      driver.seek(back / fps);
    }
  }

  export async function capture(times: number[], source: string, captureWidth = CAPTURE_WIDTH): Promise<CapturedFrame[]> {
    if (!host) {
      throw new Error('the preview is still loading');
    }
    const request = { format: FrameFormat.Jpeg, width: captureWidth, height: Math.round((captureWidth * height) / width), quality: CAPTURE_QUALITY };
    const aside = await mountCapturePlayer(host, source);
    try {
      const frames: CapturedFrame[] = [];
      for (const time of times) {
        const reply = await aside.shoot(time, request);
        frames.push({ time, data: reply.url ?? '', layout: reply.layout ?? '', errors: reply.errors ?? [] });
      }
      return frames;
    } finally {
      aside.dispose();
    }
  }

  export function still(time: number, captureWidth = CAPTURE_WIDTH, format: FrameFormat = FrameFormat.Jpeg): Promise<string> {
    const request = { format, width: captureWidth, height: Math.round((captureWidth * height) / width), quality: CAPTURE_QUALITY };
    return driver.exclusive(async () => {
      await driver.whenLive();
      await driver.fresh(html);
      try {
        return (await shoot(time, request)).url ?? '';
      } finally {
        driver.seek(frame / fps);
      }
    });
  }

  export async function measure(pose: Pose = Pose.Base): Promise<Record<string, MeasuredBox>> {
    if (!ready && !(await whenReady())) {
      return {};
    }
    const target = player?.iframeElement?.contentWindow;
    if (!target || capturing) {
      return {};
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
      target.postMessage({ type: MEASURE_REQUEST, id, pose }, '*');
    });
  }

  let textEditing = $state(false);
  let editSession = '';

  export async function editText(selector: string, at: FramePoint | null, oninput: (text: string) => void): Promise<string | null> {
    const target = (await whenReady()) ? player?.iframeElement?.contentWindow : null;
    if (!target) {
      return null;
    }
    const id = crypto.randomUUID();
    editSession = id;
    textEditing = true;
    if (player) {
      player.style.opacity = '';
    }
    player?.iframeElement?.focus();
    return new Promise((resolve) => {
      const onMessage = (e: MessageEvent) => {
        const m = e.data as TextEditMessage;
        if (e.source !== target || !m || m.id !== id) {
          return;
        }
        if (m.type === TEXT_EDIT.input) {
          oninput(m.text);
          return;
        }
        if (m.type !== TEXT_EDIT.end) {
          return;
        }
        window.removeEventListener('message', onMessage);
        if (editSession === id) {
          textEditing = false;
          player?.iframeElement?.blur();
          window.focus();
          if (player && DRAWN_OVER.has(engine)) {
            player.style.opacity = '0';
          }
        }
        resolve(m.end === EditEnd.Commit ? m.text : null);
      };
      window.addEventListener('message', onMessage);
      target.postMessage({ type: TEXT_EDIT.start, id, selector, ...(at ?? {}) }, '*');
    });
  }

  export function isTextEditing(): boolean {
    return textEditing;
  }

  export function stopTextEdit() {
    player?.iframeElement?.contentWindow?.postMessage({ type: TEXT_EDIT.stop }, '*');
  }

  function showPlayer(reason: unknown) {
    console.warn('motion preview: GPU engine unavailable, HTML engine shown', reason);
    if (player) {
      player.style.opacity = '';
    }
  }

  async function renderOnGpu(compose: Compose, times: number[], onFrame: (bitmap: ImageBitmap, index: number) => Promise<void>, signal: AbortSignal, lanes: number): Promise<boolean> {
    const { gpuEngine, GpuIneligible } = await import('$lib/motion/gpu/engine');
    const engine = host ? await gpuEngine(compose, host).catch((e) => (e instanceof GpuIneligible ? null : Promise.reject(e))) : null;
    if (!engine) {
      return false;
    }
    try {
      await engine.renderFrames(times, onFrame, lanes, signal);
      return true;
    } finally {
      engine.dispose();
    }
  }

  export async function render(times: number[], size: FrameSize, onFrame: (bitmap: ImageBitmap, index: number) => Promise<void>, signal: AbortSignal, source: string = html, profile: CaptureProfile = CaptureProfile.Fast, prefer: RenderEngine = engine): Promise<void> {
    const { settle, lanes } = CAPTURE_PROFILES[profile];
    exportedOn = RenderEngine.Gpu;
    if (prefer === RenderEngine.Gpu && gpuCompose && source === html && size.width === width && size.height === height && width % 2 === 0 && height % 2 === 0 && (await renderOnGpu(gpuCompose, times, onFrame, signal, lanes()))) {
      return;
    }
    exportedOn = RenderEngine.Html;
    const request = { format: FrameFormat.Bitmap, settle, layering: exportLayering(), ...size };
    return borrowed(source, async () => {
      const extra = host ? await Promise.all(Array.from({ length: lanesWithin(lanes(), webglPerLane(source)) - 1 }, () => mountCapturePlayer(host!, source))) : [];
      const sharedWait = CAPTURE_TIMEOUT_MS * (extra.length + 1);
      try {
        const shooters = [(time: number) => shoot(time, request, sharedWait).then(frameOf), ...extra.map((p) => (time: number) => p.shoot(time, request, sharedWait).then(frameOf))];
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
    driver.seek(target / fps);
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
    const frameEl = shown;
    const lift = host;
    const tapped = ontap;
    if (!frameEl || !lift || !tapped || live) {
      return;
    }
    return listenTap(frameEl, lift, tapped);
  });

  $effect(() => {
    driver.playback(playing ? Playback.Playing : Playback.Paused);
  });
</script>

<svelte:window onmessage={redrawn} />

<div class="stage" data-backdrop={background} style={`aspect-ratio: ${width} / ${height}; width: var(--preview-w, min(100cqw, calc(100cqh * ${width / height})));`} data-testid="motion-preview" data-engine={engine} data-export-engine={exportedOn}>
  <div class="host" bind:this={host}></div>
  {#if engine === RenderEngine.Gpu && gpuCompose}
    <div class="gpu-wrap" style:visibility={textEditing ? 'hidden' : null}>
      <GpuLayer {html} compose={gpuCompose} time={() => (playing && player ? player.currentTime : frame / fps)} onfallback={showPlayer} />
    </div>
  {/if}
  {#if FULL_ENGINES.has(engine) && fullDoc}
    <div class="gpu-wrap" style:visibility={textEditing ? 'hidden' : null}>
      {#key `${fullDoc.doc.width}x${fullDoc.doc.height}`}
        <GpuFullLayer backend={engine === RenderEngine.GpuCore ? FullBackend.Core : FullBackend.WebGl2} doc={fullDoc.doc} tokens={fullDoc.tokens} assets={fullDoc.assets} time={() => (playing && player ? player.currentTime : frame / fps)} onfallback={showPlayer} />
      {/key}
    </div>
  {/if}
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
  .gpu-wrap {
    display: contents;
  }

  .stage {
    position: relative;
    flex-shrink: 0;
    background: #000;
    outline: 1px solid var(--ui-line);
  }

  .stage[data-backdrop='transparent'] {
    background: transparent;
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
