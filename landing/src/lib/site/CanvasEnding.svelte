<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { EndingDrive, OPEN_FROM, chromeFor, driveFor, endPose, openScroll, progressOf, type Chrome, type Pose } from './canvas-ending';

  let { children, pick: pickSelector }: { children: Snippet; pick: string } = $props();

  const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
  const TIMELINE_SUPPORT = 'animation-timeline: view()';
  const MOUNT_AHEAD = '0px 0px 100% 0px';

  let root: HTMLDivElement;
  let frame: HTMLDivElement;
  let runway: HTMLDivElement;

  let drive = $state(EndingDrive.Still);
  let active = $state(false);
  let zoomed = $state(false);
  let chrome = $state<Chrome>(chromeFor(0));
  let pose = $state<Pose>({ x: 0, y: 0, scale: 1, zoom: 100 });
  let stuck = $state({ w: 0, h: 0, top: 0 });
  let pick = $state({ x: 0, y: 0, w: 0, h: 0, size: 0, leading: 0 });
  let CanvasChrome = $state<typeof import('./CanvasChrome.svelte').default | null>(null);

  function offsetWithin(el: HTMLElement, ancestor: HTMLElement) {
    let x = 0;
    let y = 0;
    for (let node: HTMLElement | null = el; node && node !== ancestor; node = node.offsetParent as HTMLElement | null) {
      x += node.offsetLeft;
      y += node.offsetTop;
    }
    return { x, y };
  }

  function measurePick() {
    const el = frame.querySelector<HTMLElement>(pickSelector);
    if (!el) {
      return;
    }

    const style = getComputedStyle(el);
    pick = { ...offsetWithin(el, frame), w: el.offsetWidth, h: el.offsetHeight, size: parseFloat(style.fontSize), leading: parseFloat(style.lineHeight) };
  }

  function measure() {
    const view = { w: document.documentElement.clientWidth, h: document.documentElement.clientHeight };
    const size = { w: frame.offsetWidth, h: frame.offsetHeight };

    chrome = chromeFor(view.w);
    pose = endPose(size, view, chrome);
    stuck = { ...size, top: view.h - size.h };
    measurePick();
  }

  async function mountChrome() {
    CanvasChrome ??= (await import('./CanvasChrome.svelte')).default;
  }

  function follow() {
    let queued = 0;

    const paint = () => {
      queued = 0;
      const r = runway.getBoundingClientRect();
      root.style.setProperty('--p', String(progressOf(r.top, r.height, document.documentElement.clientHeight)));
    };

    const queue = () => {
      queued ||= requestAnimationFrame(paint);
    };

    paint();
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);

    return () => {
      cancelAnimationFrame(queued);
      removeEventListener('scroll', queue);
      removeEventListener('resize', queue);
    };
  }

  function watch(target: Element, rootMargin: string, onChange: (entry: IntersectionObserverEntry) => void) {
    const io = new IntersectionObserver(([entry]) => onChange(entry), { rootMargin, threshold: [0, OPEN_FROM] });
    io.observe(target);
    return () => io.disconnect();
  }

  function openAt(frameY: number) {
    const view = document.documentElement.clientHeight;
    const r = runway.getBoundingClientRect();
    if (progressOf(r.top, r.height, view) < OPEN_FROM) {
      return;
    }

    scrollTo({ top: openScroll({ scrollY, runwayTop: r.top, view, stuckTop: stuck.top, frameY }), behavior: 'smooth' });
  }

  function openOnClick(e: MouseEvent) {
    if ((e.target as Element).closest('a, button')) {
      return;
    }

    const r = frame.getBoundingClientRect();
    openAt((e.clientY - r.top) / (r.height / frame.offsetHeight));
  }

  function openOnFocus(e: FocusEvent) {
    const el = e.target as HTMLElement;
    if (!el.matches(':focus-visible')) {
      return;
    }

    openAt(offsetWithin(el, frame).y);
  }

  onMount(() => {
    drive = driveFor({ reducedMotion: matchMedia(REDUCED_QUERY).matches, scrollTimeline: CSS.supports(TIMELINE_SUPPORT) });
    if (drive === EndingDrive.Still) {
      return;
    }

    const resize = new ResizeObserver(measure);
    resize.observe(frame);
    addEventListener('resize', measure);
    frame.addEventListener('click', openOnClick);
    frame.addEventListener('focusin', openOnFocus);

    const stops = [
      watch(runway, MOUNT_AHEAD, (entry) => entry.isIntersecting && mountChrome()),
      watch(runway, '0px', (entry) => {
        active = entry.isIntersecting;
        zoomed = entry.intersectionRatio >= OPEN_FROM;
      }),
      drive === EndingDrive.Script ? follow() : () => {}
    ];

    return () => {
      resize.disconnect();
      removeEventListener('resize', measure);
      frame.removeEventListener('click', openOnClick);
      frame.removeEventListener('focusin', openOnFocus);
      stops.forEach((stop) => stop());
    };
  });
</script>

<div
  class="ending"
  bind:this={root}
  data-drive={drive}
  data-active={active || undefined}
  data-zoomed={zoomed || undefined}
  style:--pose-x="{pose.x}px"
  style:--pose-y="{pose.y}px"
  style:--end-x="{pose.x}px"
  style:--end-y="{pose.y - stuck.top}px"
  style:--end-s={pose.scale}
  style:--end-zoom={pose.zoom}
  style:--end-w="{stuck.w * pose.scale}px"
  style:--end-h="{stuck.h * pose.scale}px"
  style:--from-x="{-pose.x}px"
  style:--from-y="{stuck.top - pose.y}px"
  style:--from-s={1 / pose.scale}
>
  <div class="spacer"></div>
  <div class="frame scrub" bind:this={frame}>{@render children()}</div>
  <div class="runway" bind:this={runway}></div>
  {#if CanvasChrome && drive !== EndingDrive.Still}
    <CanvasChrome kind={chrome.kind} panels={chrome.panels} {pose} frame={stuck} {pick} />
  {/if}
</div>

<style>
  .ending {
    --runway: 75svh;

    position: relative;
    timeline-scope: --ending;
  }

  .spacer {
    height: var(--runway);
  }

  .runway {
    position: absolute;
    inset: auto 0 0;
    height: var(--runway);
    view-timeline: --ending block;
    pointer-events: none;
  }

  .frame {
    position: sticky;
    bottom: 0;
    z-index: var(--site-z-frame);
    background: #000;
    transform-origin: 0 0;
    animation-name: zoom-out;
  }

  @keyframes zoom-out {
    from {
      transform: translate(0, 0) scale(1);
    }

    to {
      transform: translate(var(--end-x), var(--end-y)) scale(var(--end-s));
    }
  }

  .ending[data-zoomed] .frame {
    cursor: zoom-in;
  }

  .ending :global(.scrub) {
    animation-duration: 1s;
    animation-timing-function: linear;
    animation-fill-mode: both;
    animation-play-state: paused;
    animation-delay: calc(var(--p, 0) * -1s);
  }

  .ending[data-drive='timeline'] :global(.scrub) {
    animation-duration: auto;
    animation-delay: 0s;
    animation-play-state: running;
    animation-timeline: --ending;
    animation-range: entry-crossing 0% entry-crossing 100%;
  }

  .ending[data-drive='still'] :global(.scrub) {
    animation-name: none;
  }

  :global(.site:has(.ending) > .bar) {
    transition:
      opacity 200ms ease-out,
      visibility 0s;
  }

  :global(.site:has(.ending[data-active]) > .bar) {
    opacity: 0;
    visibility: hidden;
    transition:
      opacity 200ms ease-out,
      visibility 0s 200ms;
  }

  @media (prefers-reduced-motion: reduce) {
    .spacer,
    .runway {
      display: none;
    }

    .frame {
      position: static;
      animation-name: none;
    }
  }
</style>
