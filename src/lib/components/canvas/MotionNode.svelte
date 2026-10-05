<script lang="ts" module>
  import { SvelteMap } from 'svelte/reactivity';

  const posters = new SvelteMap<string, string>();
</script>

<script lang="ts">
  import { onMount, tick } from 'svelte';
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
  import { FORMATS } from '$lib/motion/doc';
  import { MOTION_NODE_BAR_H, type MotionNode } from '$lib/canvas/motion-node';
  import { Engagement, PreviewMode, Sight, previewClock, previewMode, scrubFrame, type MotionPreview as Preview } from '$lib/canvas/motion-preview';

  let { node, href, previewUrl, posterUrl = null }: { node: MotionNode; href: string; previewUrl: string; posterUrl?: string | null } = $props();

  const ICON = 16;
  const RELEASE_MS = 3000;
  const POSTER_WIDTH = 480;

  let root = $state<HTMLDivElement | null>(null);
  let player = $state<ReturnType<typeof MotionPreview> | null>(null);
  let sight = $state(Sight.OutOfView);
  let engagement = $state(Engagement.Idle);
  let preview = $state<Preview | null>(null);
  let frame = $state(0);
  let playing = $state(false);
  let looping = $state(false);
  let muted = $state(true);
  let hovered = $state(false);

  const size = $derived(FORMATS[node.format]);
  const mode = $derived(previewMode(sight, engagement));
  const posterKey = $derived(`${node.id}:${node.docHeadRevision}`);
  const poster = $derived(posterUrl ?? posters.get(posterKey) ?? null);
  const last = $derived(Math.max(0, (preview?.durationInFrames ?? 1) - 1));

  onMount(() => {
    const watcher = new IntersectionObserver(([entry]) => {
      sight = entry?.isIntersecting ? Sight.InView : Sight.OutOfView;
    });
    if (root) {
      watcher.observe(root);
    }
    return () => watcher.disconnect();
  });

  $effect(() => {
    if (mode !== PreviewMode.Live) {
      playing = false;
      return;
    }
    const url = `${previewUrl}?revision=${node.docHeadRevision}`;
    let stale = false;
    void fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<Preview>) : null))
      .then((next) => {
        if (!stale && next) {
          preview = next;
        }
      });
    return () => {
      stale = true;
    };
  });

  function engage() {
    hovered = true;
    engagement = Engagement.Engaged;
  }

  $effect(() => {
    if (hovered || playing || engagement === Engagement.Idle) {
      return;
    }
    const timer = setTimeout(() => void rest(), RELEASE_MS);
    return () => clearTimeout(timer);
  });

  async function rest() {
    const key = posterKey;
    if (player && preview) {
      const width = Math.min(POSTER_WIDTH, preview.width);
      const shot = await player.still(frame / preview.fps, width).catch(() => '');
      if (shot) {
        posters.set(key, shot);
      }
    }
    if (!hovered && !playing) {
      engagement = Engagement.Idle;
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
    engage();
    if (!playing && frame >= last) {
      frame = 0;
    }
    playing = !playing;
  }

  function stop() {
    playing = false;
    frame = 0;
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
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="motion"
  data-testid="motion-node"
  data-mode={mode}
  style={`--bar-h: ${MOTION_NODE_BAR_H}px;`}
  bind:this={root}
  onpointerenter={engage}
  onpointerleave={() => (hovered = false)}
  onfocusin={engage}
  onfocusout={() => (hovered = false)}
>
  <div class="stage" data-testid="motion-node-stage">
    {#if mode === PreviewMode.Live && preview}
      <MotionPreview bind:this={player} html={preview.html} width={preview.width} height={preview.height} fps={preview.fps} bind:frame bind:playing {muted} loop={looping} />
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
    {:else if poster}
      <img class="poster" src={poster} alt="" draggable="false" />
    {:else}
      <div class="empty">
        <Clapperboard size={28} />
        <span class="format">{size.label}</span>
      </div>
    {/if}
    <a class="open nodrag" {href} data-testid="open-motion-editor">Open editor</a>
  </div>

  <div class="bar nodrag nopan" onpointerdown={isolate} onclick={isolate} ondblclick={isolate}>
    <button type="button" aria-label={playing ? 'Pause' : 'Play'} onclick={toggle}>
      {#if playing}<Pause size={ICON} />{:else}<Play size={ICON} />{/if}
    </button>
    <button type="button" aria-label="Stop" disabled={!preview} onclick={stop}><Square size={ICON} /></button>
    <button type="button" aria-label="Go to start" disabled={!preview} onclick={() => seek(0)}><SkipBack size={ICON} /></button>
    <button type="button" aria-label="Go to end" disabled={!preview} onclick={end}><SkipForward size={ICON} /></button>
    <button type="button" aria-label="Loop" aria-pressed={looping} onclick={() => (looping = !looping)}><Repeat size={ICON} /></button>
    <button type="button" aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted} onclick={() => (muted = !muted)}>
      {#if muted}<VolumeX size={ICON} />{:else}<Volume2 size={ICON} />{/if}
    </button>
    <span class="rev">{node.docHeadRevision ? `Rev ${node.docHeadRevision}` : 'Empty'}</span>
  </div>
</div>

<style>
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

  .poster {
    width: 100%;
    height: 100%;
    object-fit: contain;
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
