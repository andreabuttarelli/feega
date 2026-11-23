<script lang="ts">
  import { onMount } from 'svelte';
  import { GuideId } from '..';
  import DemoChip from '../demo/DemoChip.svelte';
  import DemoCursor from '../demo/DemoCursor.svelte';
  import { createPlayer } from '../demo/player';
  import { Key, stateAt, targetSelector, type Aim, type DemoState, type Frame, type Point } from '../demo/script';
  import { SCRIPTS } from '../demo/scripts';
  import { MOCKS } from './registry';
  import { Anchor } from './subjects';

  let { id, active = true }: { id: GuideId; active?: boolean } = $props();

  const entry = $derived(MOCKS[id]);
  const script = $derived(SCRIPTS[id]);
  const Mock = $derived(entry.component);
  const Preview = $derived(entry.preview);

  let root: HTMLDivElement;
  let live = $state<DemoState | undefined>();
  const demo = $derived(live ?? stateAt(script, script.poster));
  let focus = $state<Point | undefined>();
  let cursor = $state<{ at: Point; pressed: boolean; ring: number | undefined } | undefined>();
  let inView = $state(false);
  let tabVisible = $state(true);
  let reduced = $state(false);

  const playing = $derived(active && inView && tabVisible && !reduced);
  const player = $derived(createPlayer(script, show));

  const sameState = (a: DemoState, b: DemoState) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => a[k] === b[k]);

  function resolve(aim: Aim): Point | undefined {
    const element = root.querySelector(targetSelector(aim.target));
    if (!element) {
      return undefined;
    }

    const box = element.getBoundingClientRect();
    const crop = root.getBoundingClientRect();

    return { x: box.left - crop.left + box.width / 2 + aim.dx, y: box.top - crop.top + box.height / 2 + aim.dy };
  }

  function show(frame: Frame) {
    if (!live || !sameState(live, frame.state)) {
      live = frame.state;
    }

    focus = frame.focus;

    const from = resolve(frame.cursor.from);
    const to = resolve(frame.cursor.to);
    if (!from || !to) {
      return;
    }

    const p = frame.cursor.progress;
    cursor = { at: { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p }, pressed: frame.pressed, ring: frame.ring };
  }

  onMount(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => (reduced = motion.matches);
    const onVisibility = () => (tabVisible = !document.hidden);
    const watcher = new IntersectionObserver(([entry]) => (inView = entry.isIntersecting));

    onMotion();
    onVisibility();
    motion.addEventListener('change', onMotion);
    document.addEventListener('visibilitychange', onVisibility);
    watcher.observe(root);

    return () => {
      motion.removeEventListener('change', onMotion);
      document.removeEventListener('visibilitychange', onVisibility);
      watcher.disconnect();
      player.pause();
    };
  });

  $effect(() => {
    if (playing) {
      player.play();

      return () => player.pause();
    }
  });

  $effect(() => {
    if (!active) {
      player.reset();
      live = undefined;
      focus = undefined;
      cursor = undefined;
    }
  });
</script>

<div class="crop" bind:this={root} data-mock-for={id} style:--fx={(focus ?? entry.focus).x} style:--fy={(focus ?? entry.focus).y} style:--zp={entry.zoom.phone} style:--zd={entry.zoom.desktop}>
  <div class="placed" class:corner={entry.anchor === Anchor.TopRight}><Mock {...entry.props} {demo} /></div>
  {#if Preview}<div class="strip"><Preview {demo} /></div>{/if}
  <DemoChip text={demo[Key.Chip] ?? ''} />
  {#if cursor}<DemoCursor at={cursor.at} pressed={cursor.pressed} ring={cursor.ring} />{/if}
</div>

<style>
  .crop {
    --z: var(--zp);

    position: relative;
    width: 100%;
    max-width: 520px;
    height: 240px;
    overflow: hidden;
    border-radius: 12px;
    background: #0d0d0d;
  }

  .placed {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(calc(var(--fx) * var(--z) * -1px), calc(var(--fy) * var(--z) * -1px)) scale(var(--z));
    transform-origin: 0 0;
    transition: transform 0.9s cubic-bezier(0.87, 0, 0.13, 1);
  }

  .placed.corner {
    top: 0;
    right: 0;
    left: auto;
    transform: scale(var(--z));
    transform-origin: 100% 0;
  }

  .strip {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    border-bottom: 1px solid #2b2b2b;
    background: #0d0d0d;
    pointer-events: none;
  }

  @media (min-width: 900px) {
    .crop {
      --z: var(--zd);

      height: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .placed {
      transition: none;
    }
  }
</style>
