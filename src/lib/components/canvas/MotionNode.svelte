<script lang="ts" module>
  import { SvelteMap } from 'svelte/reactivity';

  import type { Slots, MotionPreview as Preview } from '$lib/canvas/motion-preview';

  const posters = new SvelteMap<string, string>();
  const previews = new Map<string, Preview>();
  const shooting = new Set<string>();
  let slots = $state<Slots>({ playing: null, capturing: null });
</script>

<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import Clapperboard from '@lucide/svelte/icons/clapperboard';
  import Play from '@lucide/svelte/icons/play';
  import Pause from '@lucide/svelte/icons/pause';
  import Square from '@lucide/svelte/icons/square';
  import SkipBack from '@lucide/svelte/icons/skip-back';
  import SkipForward from '@lucide/svelte/icons/skip-forward';
  import Repeat from '@lucide/svelte/icons/repeat';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import VolumeX from '@lucide/svelte/icons/volume-x';
  import MotionPreview from '$lib/components/motion/MotionPreview.svelte';
  import FrameHover from './FrameHover.svelte';
  import { warmPlayer, whenIdle } from '$lib/motion/hyperframes/warm-player';
  import { Background, FORMATS } from '$lib/motion/doc';
  import { MOTION_NODE_BAR_H, frameChrome, type MotionNode } from '$lib/canvas/motion-node';
  import { NodeMode, Paint, Under, nodeLayers, ownPlayer } from '$lib/canvas/inline-motion';
  import { DRAWN_EVENT } from '$lib/motion/hyperframes/measure';
  import { inlineStage } from '$lib/canvas/inline-stage.svelte';
  import { frameDocs, posterCurrent } from '$lib/canvas/frame-docs.svelte';
  import { posterDue, tiles } from '$lib/canvas/live-tiles.svelte';
  import { canvasLod } from '$lib/canvas/canvas-lod.svelte';
  import { POSTER_WIDTH, sendPoster } from '$lib/motion/poster-capture';
  import { coverFrame } from '$lib/motion/still';
  import { Intent, PreviewMode, Sight, Still, captureFree, claimCapture, intentOf, play, previewClock, previewMode, releaseCapture, scrubFrame, stop as stopIn } from '$lib/canvas/motion-preview';

  let { node, href, previewUrl, posterUrl = null, nodeMode = NodeMode.Preview, onopen = null, onenter = null }: { node: MotionNode; href: string; previewUrl: string; posterUrl?: string | null; nodeMode?: NodeMode; onopen?: (() => void) | null; onenter?: (() => void) | null } = $props();

  let host = $state<HTMLDivElement | null>(null);
  const nodeId = $derived(node.id);

  $effect(() => (host ? inlineStage.offer(nodeId, host) : undefined));

  const ICON = 16;

  let root = $state<HTMLDivElement | null>(null);
  let player = $state<ReturnType<typeof MotionPreview> | null>(null);
  let sight = $state<Sight>(Sight.OutOfView);
  let settledSight = $state<Sight>(Sight.OutOfView);
  let fetched = $state<Preview | null>(null);
  let previewRevision = $state(-1);
  let frame = $state(0);
  let playing = $state(false);
  let looping = $state(false);
  let muted = $state(true);

  const size = $derived(FORMATS[node.format]);
  const posterKey = $derived(`${node.id}:${node.docHeadRevision}`);
  const local = $derived(frameDocs.latest(node.id, node.docHeadRevision));
  let lastLocal = $state.raw<Preview | null>(null);
  const preview = $derived(local ?? (previewRevision === node.docHeadRevision ? fetched : null) ?? lastLocal ?? fetched);
  const poster = $derived(posterCurrent(local) ? (posterUrl ?? posters.get(posterKey) ?? null) : null);
  const still = $derived(posterCurrent(local) && (posterUrl || posters.has(posterKey)) ? Still.Ready : Still.Missing);
  const intent = $derived(intentOf(slots, node.id));
  const mode = $derived(previewMode(sight, intent, still));
  const capturing = $derived(mode === PreviewMode.Capture && slots.capturing === node.id);
  const last = $derived(Math.max(0, (preview?.durationInFrames ?? 1) - 1));
  const paint = $derived(inlineStage.paintOf(node.id));
  const layers = $derived(nodeLayers(nodeMode, paint));
  const chrome = $derived(frameChrome(node.kind));
  const previewing = $derived(nodeMode === NodeMode.Preview);
  const liveHere = $derived(settledSight === Sight.InView && !canvasLod.far && !(nodeMode === NodeMode.Edit && paint !== Paint.Pending && chrome.under === Under.Released));
  const liveTile = $derived(liveHere && (!!local || node.docHeadRevision > 0) && (!previewing || tiles.live(node.id)));
  const capturable = $derived(nodeMode !== NodeMode.Edit && !liveTile);
  let ownDrawn = $state(false);
  let decodedPoster = $state<string | null>(untrack(() => poster));
  const shownPoster = $derived(posterCurrent(local) && decodedPoster === poster ? decodedPoster : null);
  const painted = $derived(ownDrawn || (!liveTile && !!poster && shownPoster === poster));
  const playerUp = $derived(mounted && !!preview);
  const mounted = $derived(nodeMode !== NodeMode.Edit && ownPlayer(nodeMode, paint, mode === PreviewMode.Live || capturing || liveTile, chrome.under));

  onMount(() => {
    whenIdle(() => void warmPlayer(location.origin));
    const watcher = new IntersectionObserver(([entry]) => {
      sight = entry?.isIntersecting ? Sight.InView : Sight.OutOfView;
    });
    if (root) {
      watcher.observe(root);
    }
    return () => {
      watcher.disconnect();
      slots = releaseCapture(stopIn(slots, node.id), node.id);
    };
  });

  $effect(() => {
    if (!canvasLod.moving) {
      settledSight = sight;
    }
  });

  $effect(() => {
    if (sight === Sight.OutOfView) {
      slots = stopIn(slots, node.id);
    }
  });

  $effect(() => {
    const id = node.id;
    if (settledSight === Sight.OutOfView || canvasLod.far) {
      tiles.drop(id);
      return;
    }
    tiles.want(id);
    return () => tiles.drop(id);
  });

  $effect(() => {
    if (intent !== Intent.Play) {
      return;
    }
    const deselect = (e: PointerEvent) => {
      if (!root?.contains(e.target as Node)) {
        slots = stopIn(slots, node.id);
      }
    };
    document.addEventListener('pointerdown', deselect, true);
    return () => document.removeEventListener('pointerdown', deselect, true);
  });

  $effect(() => {
    if (capturable && mode === PreviewMode.Capture && captureFree(slots)) {
      slots = claimCapture(slots, node.id);
    }
  });

  $effect(() => {
    if (!mounted) {
      playing = false;
      return;
    }
    if (local) {
      return;
    }
    const revision = node.docHeadRevision;
    const key = `${node.id}:${revision}`;
    const cached = previews.get(key);
    if (cached) {
      fetched = cached;
      previewRevision = revision;
      return;
    }
    const url = `${previewUrl}?revision=${revision}`;
    let stale = false;
    void fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<Preview>) : null))
      .then((next) => {
        if (next) {
          previews.set(key, next);
        }
        if (!stale && next) {
          fetched = next;
          previewRevision = revision;
        }
      });
    return () => {
      stale = true;
    };
  });

  $effect(() => {
    const key = posterKey;
    const ask = { live: liveTile && previewing, drawn: ownDrawn, unsaved: frameDocs.unsaved(node.id, node.docHeadRevision), atHead: local ? local.version === node.docHeadRevision : previewRevision === node.docHeadRevision, hasPoster: !!posterUrl || posters.has(key), shooting: shooting.has(key) };
    if (!player || !preview || !posterDue(ask)) {
      return;
    }
    shooting.add(key);
    const shooter = player;
    const source = preview;
    whenIdle(() => void captureCover(shooter, source, key, node.docHeadRevision).finally(() => shooting.delete(key)));
  });

  $effect(() => {
    if (capturing && player && preview && previewRevision === node.docHeadRevision) {
      void captureCover(player, preview, posterKey, node.docHeadRevision);
    }
  });

  $effect(() => {
    if (!(mounted && preview)) {
      ownDrawn = false;
    }
  });

  $effect(() => {
    if (local) {
      lastLocal = local;
    }
  });

  $effect(() => {
    const source = preview;
    if (!source) {
      return;
    }
    untrack(() => {
      if (!playing && intent !== Intent.Play) {
        frame = coverFrame(source);
      }
    });
  });

  $effect(() => {
    if (nodeMode === NodeMode.Leaving && painted) {
      inlineStage.landed(node.id);
    }
  });

  $effect(() => {
    const el = root;
    if (!el) {
      return;
    }
    const drawn = () => (ownDrawn = true);
    el.addEventListener(DRAWN_EVENT, drawn);
    return () => el.removeEventListener(DRAWN_EVENT, drawn);
  });

  $effect(() => {
    const next = poster;
    if (!next || next === decodedPoster) {
      return;
    }
    let stale = false;
    void decoded(next).then(() => {
      if (!stale) {
        decodedPoster = next;
      }
    });
    return () => {
      stale = true;
    };
  });

  async function decoded(src: string) {
    const img = new Image();
    img.src = src;
    await img.decode().catch(() => undefined);
  }

  async function captureCover(shooter: NonNullable<typeof player>, source: Preview, key: string, revision: number) {
    const width = Math.min(POSTER_WIDTH, source.width);
    const shot = await shooter.still(coverFrame(source) / source.fps, width, chrome.poster).catch(() => '');
    if (shot) {
      await decoded(shot);
    }
    posters.set(key, shot);
    slots = releaseCapture(slots, node.id);
    if (shot) {
      void sendPoster(`${href}?/poster`, shot, { width: String(width), height: String(Math.round((width * source.height) / source.width)), revision: String(revision) }).catch(() => undefined);
    }
  }

  async function seek(target: number) {
    const resume = playing;
    playing = false;
    frame = target;
    await tick();
    playing = resume;
  }

  function toggle() {
    slots = play(slots, node.id);
    if (!playing && frame >= last) {
      frame = 0;
    }
    playing = !playing;
  }

  function stop() {
    playing = false;
    frame = 0;
    slots = stopIn(slots, node.id);
  }

  function end() {
    playing = false;
    frame = last;
  }

  function scrub(e: Event) {
    const ratio = Number((e.currentTarget as HTMLInputElement).value);
    playing = false;
    frame = scrubFrame(ratio, preview?.durationInFrames ?? 1);
  }

  function isolate(e: Event) {
    e.stopPropagation();
  }

  function open(e: MouseEvent) {
    if (!onopen) {
      return;
    }
    e.preventDefault();
    onopen();
  }
</script>

<div
  class="motion"
  class:editing={!previewing}
  class:bare={!chrome.bar}
  data-kind={node.kind}
  ondblclick={() => onenter?.()}
  data-testid="motion-node"
  data-motion-node={node.id}
  data-mode={mode}
  style={`--bar-h: ${MOTION_NODE_BAR_H}px;`}
  bind:this={root}
>
  <div class="stage" data-testid="motion-node-stage" data-frame-stage>
    {#if layers.own || mounted}
      {#if shownPoster && !(playerUp && ownDrawn)}
        <img class="poster" class:under={playerUp} class:kept={!layers.own} src={shownPoster} alt="" draggable="false" data-testid="motion-node-poster" />
      {/if}
      {#if mounted && preview}
        <div class="own" class:kept={!layers.own} data-drawn={ownDrawn}><MotionPreview bind:this={player} html={preview.html} background={chrome.bar ? Background.Brand : Background.Transparent} width={preview.width} height={preview.height} fps={preview.fps} bind:frame bind:playing {muted} loop={looping} /></div>
        {#if previewing && chrome.bar}
          <span class="clock" data-testid="motion-node-timecode">{previewClock(frame, preview.fps, preview.durationInFrames)}</span>
          <input
            class="scrub nodrag nopan"
            type="range"
            min="0"
            max="1"
            step="any"
            aria-label="Seek"
            value={frame / Math.max(1, preview.durationInFrames)}
            oninput={scrub}
            onpointerdown={isolate}
            onclick={isolate}
          />
        {/if}
      {:else if shownPoster}
      {:else if !previewing}
        <div class="skeleton" data-testid="motion-node-skeleton"></div>
      {:else if !chrome.bar}
        <div class="placeholder" data-testid="element-placeholder"></div>
      {:else}
        <div class="empty">
          <Clapperboard size={28} />
          <span class="format">{size.label}</span>
        </div>
      {/if}
    {/if}
    {#if !previewing}<div class="host" class:nodrag={layers.editor} class:nopan={layers.editor} data-testid="motion-node-editing" bind:this={host}></div>{/if}
    {#if previewing && node.docHeadRevision}<FrameHover nodeId={node.id} revision={node.docHeadRevision} {previewUrl} width={size.width} height={size.height} />{/if}
    {#if previewing && chrome.bar}<a class="open nodrag" {href} data-testid="open-motion-editor" data-sveltekit-preload-data={onopen ? 'off' : 'hover'} onclick={open}>Open editor</a>{/if}
  </div>

  {#if previewing && chrome.bar}
  <div class="bar nodrag nopan" onpointerdown={isolate} onclick={isolate} ondblclick={isolate}>
    <button type="button" aria-label={playing ? 'Pause' : 'Play'} onclick={toggle}>
      {#if playing}<Pause size={ICON} />{:else}<Play size={ICON} />{/if}
    </button>
    <button type="button" aria-label="Stop" disabled={intent !== Intent.Play} onclick={stop}><Square size={ICON} /></button>
    <button type="button" aria-label="Go to start" disabled={!preview} onclick={() => seek(0)}><SkipBack size={ICON} /></button>
    <button type="button" aria-label="Go to end" disabled={!preview} onclick={end}><SkipForward size={ICON} /></button>
    <button type="button" aria-label="Loop" aria-pressed={looping} onclick={() => (looping = !looping)}><Repeat size={ICON} /></button>
    <button type="button" aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted} onclick={() => (muted = !muted)}>
      {#if muted}<VolumeX size={ICON} />{:else}<Volume2 size={ICON} />{/if}
    </button>
    <span class="rev">{node.docHeadRevision ? `Rev ${node.docHeadRevision}` : 'Empty'}</span>
  </div>
  {/if}
</div>

<style>
  :global(.motion.is-frame-drop) {
    outline: 2px solid var(--accent, #0a84ff);
    outline-offset: 2px;
  }
  .motion {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--ui-surface);
    border: 1px solid var(--ui-line);
    border-radius: 0;
  }

  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    container-type: size;
    background: #000;
    color: #f0eee9;
  }

  .kept {
    visibility: hidden;
  }

  .own {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .poster.under {
    position: absolute;
    inset: 0;
  }

  .host {
    position: absolute;
    inset: 0;
  }

  .motion.bare {
    background: transparent;
    border-color: transparent;
  }

  .motion.bare .stage {
    background: transparent;
  }

  .placeholder {
    position: absolute;
    inset: 0;
    outline: 1px dashed var(--ui-line);
  }

  .poster {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .skeleton {
    position: absolute;
    inset: 0;
    background: var(--ui-field, #f2f2f2);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .format,
  .clock {
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
  }

  .format {
    color: var(--ui-accent);
  }

  .clock {
    position: absolute;
    left: 6px;
    top: 6px;
    padding: 2px 4px;
    background: rgb(0 0 0 / 0.6);
    pointer-events: none;
  }

  .open {
    position: absolute;
    z-index: 2;
    right: 6px;
    top: 6px;
    padding: 4px 8px;
    font-size: var(--ui-text-xs);
    background: var(--ui-surface);
    color: var(--ui-ink);
    border: 1px solid var(--ui-line);
    border-radius: 0;
  }

  .scrub {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 44px;
    margin: 0;
    padding: 0 6px;
    background: linear-gradient(transparent, rgb(0 0 0 / 0.5));
    accent-color: var(--ui-accent);
    cursor: pointer;
  }

  .bar {
    display: flex;
    align-items: center;
    height: var(--bar-h);
    flex-shrink: 0;
    border-top: 1px solid var(--ui-line);
    color: var(--ui-ink);
  }

  .bar button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .bar button:hover:not(:disabled) {
    background: var(--ui-hover);
  }

  .bar button:focus-visible {
    outline: 2px solid var(--ui-focus);
    outline-offset: -2px;
  }

  .bar button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .bar button[aria-pressed='true'] {
    color: var(--ui-accent);
  }

  .rev {
    margin-left: auto;
    padding: 0 8px;
    font-size: var(--ui-text-xs);
    white-space: nowrap;
    overflow: hidden;
  }
</style>
