
<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { HOST_MESSAGE } from '$lib/motion/interactive/host';
  import { HostCommand, PLAYER_MESSAGE, PlayerEvent } from '$lib/motion/interactive/protocol';
  import { SwipeStep, adjacentFrame, swipeStep } from '$lib/canvas/frame-viewer';
  import LegalFooter from '$lib/components/LegalFooter.svelte';
  import { reportHref } from '$lib/reports/report-link';

  let { data, form } = $props();

  const PLAYING_GRACE_MS = 600;

  let frameEl = $state<HTMLIFrameElement | null>(null);
  let playing = $state(true);
  let silence: ReturnType<typeof setTimeout> | undefined;
  let copying = $state(false);
  let touchFrom: { x: number; y: number } | null = null;

  const position = $derived(data.frame.frames.findIndex((f) => f.id === data.frame.frameId) + 1);
  const previous = $derived(adjacentFrame(data.frame.frames, data.frame.frameId, SwipeStep.Previous));
  const next = $derived(adjacentFrame(data.frame.frames, data.frame.frameId, SwipeStep.Next));

  const hrefOf = (id: string) => `/s/${page.params.token}/${id}`;

  function send(command: HostCommand) {
    frameEl?.contentWindow?.postMessage({ type: HOST_MESSAGE, command }, '*');
  }

  function toggle() {
    playing = !playing;
    send(playing ? HostCommand.Play : HostCommand.Pause);
  }

  function onPlayer(e: MessageEvent) {
    if (e.source !== frameEl?.contentWindow || e.data?.type !== PLAYER_MESSAGE || e.data.event !== PlayerEvent.TimeUpdate) {
      return;
    }
    playing = true;
    clearTimeout(silence);
    silence = setTimeout(() => (playing = false), PLAYING_GRACE_MS);
  }

  function go(id: string | null) {
    if (id) {
      void goto(hrefOf(id));
    }
  }

  function onTouchStart(e: TouchEvent) {
    const t = e.changedTouches[0];
    touchFrom = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: TouchEvent) {
    const t = e.changedTouches[0];
    const from = touchFrom;
    touchFrom = null;
    if (!from) {
      return;
    }
    const step = swipeStep(t.clientX - from.x, t.clientY - from.y);
    if (step === SwipeStep.None) {
      toggle();
      return;
    }
    go(step === SwipeStep.Next ? next : previous);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') {
      go(next);
    } else if (e.key === 'ArrowLeft') {
      go(previous);
    } else if (e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  }
</script>

<svelte:window onmessage={onPlayer} onkeydown={onKey} />

<svelte:head>
  <title>{data.frame.title}</title>
  <meta name="robots" content="noindex" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
</svelte:head>

<main class="viewer">
  {#key data.frame.frameId}
    <iframe bind:this={frameEl} class="stage" src={data.embedSrc} title={data.frame.title} allow="autoplay"></iframe>
  {/key}

  <button
    type="button"
    class="tap"
    aria-label={playing ? 'Pause' : 'Play'}
    onclick={() => !('ontouchstart' in window) && toggle()}
    ontouchstart={onTouchStart}
    ontouchend={onTouchEnd}
  >
    {#if !playing}
      <span class="play" aria-hidden="true"></span>
    {/if}
  </button>

  <header class="bar">
    <h1>{data.frame.title}</h1>
    {#if data.frame.frames.length > 1}
      <nav class="pager" aria-label="Frames">
        <a href={previous ? hrefOf(previous) : undefined} aria-disabled={!previous} aria-label="Previous frame">‹</a>
        <span>{position} / {data.frame.frames.length}</span>
        <a href={next ? hrefOf(next) : undefined} aria-disabled={!next} aria-label="Next frame">›</a>
      </nav>
    {/if}
  </header>

  <form
    class="copy"
    method="POST"
    action={data.signedIn ? '?/duplicate' : '?/signin'}
    use:enhance={() => {
      copying = true;
      return async ({ update }) => {
        await update();
        copying = false;
      };
    }}
  >
    {#if data.signedIn && data.projects.length > 1}
      <select name="project" aria-label="Into project">
        {#each data.projects as project (project.id)}<option value={project.id}>{project.name}</option>{/each}
      </select>
    {:else if data.signedIn && data.projects.length === 1}
      <input type="hidden" name="project" value={data.projects[0].id} />
    {/if}
    <button type="submit" disabled={copying || (data.signedIn && !data.projects.length)} data-testid="duplicate-frame">{copying ? 'Copying…' : 'Duplicate to my workspace'}</button>
    {#if form?.error}<span class="warn" role="alert">{form.error}</span>{/if}
  </form>

  <a class="mark" href="/">feega</a>
  <div class="legal-mark">
    <a class="report" href={reportHref({ share: page.params.token })} rel="nofollow">Report</a>
    <LegalFooter />
  </div>
</main>

<style>
  .viewer {
    position: fixed;
    inset: 0;
    background: #000;
    overscroll-behavior: none;
    touch-action: pan-y;
  }
  .stage {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    pointer-events: none;
  }
  .tap {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: transparent;
    border: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .play {
    width: 72px;
    height: 72px;
    border-radius: var(--ui-radius-full, 9999px);
    background: rgb(0 0 0 / 0.55)
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 6v12l10-6z'/%3E%3C/svg%3E") center / 40% no-repeat;
  }
  .bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: calc(10px + env(safe-area-inset-top, 0px)) calc(14px + env(safe-area-inset-right, 0px)) 10px calc(14px + env(safe-area-inset-left, 0px));
    color: #fff;
    background: linear-gradient(rgb(0 0 0 / 0.5), transparent);
    pointer-events: none;
  }
  h1 {
    margin: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 14px;
    font-weight: 600;
  }
  .pager {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    pointer-events: auto;
    white-space: nowrap;
  }
  .pager a {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    font-size: 22px;
    color: #fff;
    text-decoration: none;
  }
  .pager a[aria-disabled='true'] {
    opacity: 0.3;
    pointer-events: none;
  }
  .copy {
    position: absolute;
    left: 50%;
    bottom: calc(52px + env(safe-area-inset-bottom, 0px));
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: calc(100vw - 28px);
  }
  .copy button,
  .copy select {
    padding: 9px 14px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    background: rgb(0 0 0 / 0.6);
    border: 1px solid rgb(255 255 255 / 0.3);
    border-radius: var(--ui-radius-sm);
  }
  .copy button:disabled {
    opacity: 0.5;
  }
  .warn {
    font-size: 12px;
    color: #ffb4b4;
  }
  .mark {
    position: absolute;
    left: calc(14px + env(safe-area-inset-left, 0px));
    bottom: calc(10px + env(safe-area-inset-bottom, 0px));
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: rgb(255 255 255 / 0.7);
    text-decoration: none;
  }
  .legal-mark {
    display: flex;
    align-items: center;
    position: absolute;
    right: calc(14px + env(safe-area-inset-right, 0px));
    bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  }
  .report {
    margin-right: 10px;
    font-size: 11px;
    color: rgb(255 255 255 / 0.7);
  }
  @media (max-width: 640px) {
    .legal-mark {
      display: none;
    }
  }
</style>
