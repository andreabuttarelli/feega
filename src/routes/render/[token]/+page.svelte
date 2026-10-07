<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import Download from '@lucide/svelte/icons/download';
  import Share2 from '@lucide/svelte/icons/share-2';
  import MotionPreview from '$lib/components/motion/MotionPreview.svelte';
  import { composeHtml } from '$lib/motion/hyperframes/compose';
  import { audioPlan } from '$lib/motion/audio-plan';
  import { BROWSER_RESOLUTIONS, eta, exportSize, type Capabilities } from '$lib/motion/export-plan';
  import { capabilities } from '$lib/motion/export/encode';
  import { BrowserStage, renderInBrowser } from '$lib/motion/export/browser-render';
  import { cancelLink, saveToLink } from '$lib/motion/export/link-upload';
  import { RenderPlace, renderPlace, thisDevice, type Device, type PlaceVerdict } from '$lib/motion/render-place';
  import { Preset, settingsOf } from '$lib/motion/export-formats';
  import { REFUSAL_TEXT } from '$lib/motion/render-link';
  import { profileOf } from '$lib/motion/export/capture-profile';
  import type { Resolution } from '$lib/motion/render-quote';

  let { data } = $props();

  const Phase = { Checking: 'checking', Ready: 'ready', Blocked: 'blocked', Mixing: 'mixing', Rendering: 'rendering', Saving: 'saving', Done: 'done', Failed: 'failed', Cancelled: 'cancelled' } as const;
  type Phase = (typeof Phase)[keyof typeof Phase];

  const PHASE_LABEL: Partial<Record<Phase, string>> = {
    [Phase.Mixing]: 'Mixing audio…',
    [Phase.Rendering]: 'Rendering frames…',
    [Phase.Saving]: 'Saving to your project…'
  };
  const STAGE_PHASE: Record<BrowserStage, Phase> = { [BrowserStage.Mixing]: Phase.Mixing, [BrowserStage.Rendering]: Phase.Rendering };
  const MIME = 'video/mp4';
  const CAPTURE_PARAM = 'capture';

  const render = data.render;
  const html = render ? composeHtml({ doc: render.doc, tokens: render.tokens, assets: render.assetUrls, analyses: render.analyses }) : '';
  const total = render?.doc.durationInFrames ?? 0;
  const seconds = render ? render.doc.durationInFrames / render.doc.fps : 0;
  const hasAudio = render ? audioPlan(render.doc, render.assetUrls).length > 0 : false;

  let preview = $state<MotionPreview | null>(null);
  let phase = $state<Phase>(Phase.Checking);
  let caps = $state<Capabilities | null>(null);
  let device = $state<Device | null>(null);
  let resolution = $state<Resolution | null>(null);
  let blocked = $state('');
  let done = $state(0);
  let startedAt = $state(0);
  let now = $state(0);
  let paused = $state(false);
  let error = $state('');
  let file = $state<File | null>(null);
  let downloadUrl = $state('');
  let controller: AbortController | null = null;

  const busy = $derived(phase === Phase.Mixing || phase === Phase.Rendering || phase === Phase.Saving);
  const remaining = $derived(eta({ done, total, elapsedMs: now - startedAt }));
  const canShare = $derived(file !== null && typeof navigator !== 'undefined' && Boolean(navigator.canShare?.({ files: [file] })));

  function verdict(r: Resolution, c: Capabilities, d: Device): PlaceVerdict {
    return renderPlace({ doc: render!.doc, settings: { ...settingsOf(Preset.Social), resolution: r }, capabilities: c, device: d, background: false, hasAudio });
  }

  const allowed = $derived(caps && device ? BROWSER_RESOLUTIONS.filter((r) => verdict(r, caps!, device!).place === RenderPlace.Browser) : []);

  onMount(() => {
    if (!render) {
      return;
    }
    device = thisDevice(navigator);
    void capabilities(render.doc).then((c) => {
      caps = c;
      const fits = BROWSER_RESOLUTIONS.filter((r) => verdict(r, c, device!).place === RenderPlace.Browser);
      if (!fits.length) {
        const refusal = verdict(BROWSER_RESOLUTIONS[0], c, device!);
        blocked = refusal.place === RenderPlace.Farm ? refusal.message : '';
        phase = Phase.Blocked;
        return;
      }
      resolution = fits[fits.length - 1];
      phase = Phase.Ready;
    });
    return () => {
      controller?.abort();
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  });

  function etaLabel(s: number | null): string {
    if (s === null) {
      return 'estimating…';
    }
    return s < 60 ? `about ${s}s left` : `about ${Math.ceil(s / 60)} min left`;
  }

  async function start() {
    if (!render || !resolution || !preview) {
      return;
    }
    controller = new AbortController();
    error = '';
    done = 0;
    const size = exportSize(render.doc, resolution);
    try {
      const blob = await renderInBrowser({
        doc: render.doc,
        assetUrls: render.assetUrls,
        size,
        withAudio: Boolean(caps?.aac),
        frames: (times, s, onFrame, signal) => preview!.render(times, s, onFrame, signal, html, profileOf(page.url.searchParams.get(CAPTURE_PARAM))),
        signal: controller.signal,
        onStage: (stage) => {
          phase = STAGE_PHASE[stage];
          startedAt = performance.now();
        },
        onFrame: (n) => {
          done = n;
          now = performance.now();
        },
        onPause: (p) => (paused = p)
      });
      file = new File([blob], `${render.name}.mp4`, { type: MIME });
      downloadUrl = URL.createObjectURL(blob);

      phase = Phase.Saving;
      const saved = await saveToLink(page.url.pathname, blob, { ...size, seconds });
      if (!saved.ok) {
        error = `Not saved to your project (${saved.error}). The download below still works.`;
      }
      phase = Phase.Done;
    } catch (e) {
      if (controller.signal.aborted) {
        phase = Phase.Ready;
        return;
      }
      error = e instanceof Error ? e.message : String(e);
      phase = Phase.Failed;
    }
  }

  async function cancel() {
    controller?.abort();
    await cancelLink(page.url.pathname);
    phase = Phase.Cancelled;
  }

  async function share() {
    if (file) {
      await navigator.share({ files: [file], title: render?.name }).catch(() => {});
    }
  }
</script>

<svelte:head>
  <title>Render · {render?.name ?? 'feega'}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="render-page" data-testid="render-page">
  {#if data.refused}
    <h1>Render</h1>
    <p class="warn" role="alert" data-testid="render-refused">{REFUSAL_TEXT[data.refused]}</p>
  {:else if render}
    <header>
      <h1>{render.name}</h1>
      <span class="meta">v{render.revision} · {Math.round(seconds)} s · {render.doc.fps} fps</span>
    </header>

    <div class="stage" style={`aspect-ratio: ${render.doc.width} / ${render.doc.height}`}>
      <MotionPreview bind:this={preview} {html} width={render.doc.width} height={render.doc.height} fps={render.doc.fps} />
    </div>

    {#if phase === Phase.Checking}
      <p class="muted">Checking what this device can encode…</p>
    {:else if phase === Phase.Blocked}
      <p class="warn" role="alert" data-testid="render-blocked">{blocked}</p>
      <p class="muted">Open this link on a computer, or ask the agent for a server render.</p>
    {:else if phase === Phase.Cancelled}
      <p class="muted" data-testid="render-cancelled">Render cancelled. Ask for a new link to try again.</p>
    {:else}
      {#if phase === Phase.Ready || phase === Phase.Failed}
        <fieldset class="choice" aria-label="Resolution">
          {#each allowed as r (r)}
            <label><input type="radio" name="res" value={r} bind:group={resolution} /> {r}</label>
          {/each}
        </fieldset>
        <p class="muted">Free: it renders on this device and saves to your project. Keep this screen on until it finishes.</p>
      {/if}

      {#if PHASE_LABEL[phase]}
        <div class="progress" data-testid="render-progress">
          <div class="track"><div class="fill" style={`width: ${(done / Math.max(1, total)) * 100}%`}></div></div>
          <span>{PHASE_LABEL[phase]} {#if phase === Phase.Rendering}{done}/{total} · {etaLabel(remaining)}{/if}</span>
        </div>
        <p class="notice" role="status">Keep this screen on and this tab open.</p>
        {#if paused}<p class="warn" role="alert" data-testid="render-paused">Paused: this tab is in the background. Come back to resume.</p>{/if}
      {/if}

      {#if phase === Phase.Failed}<p class="warn" role="alert">Render failed: {error}</p>{/if}

      {#if phase === Phase.Done}
        {#if error}<p class="warn" role="alert">{error}</p>{:else}<p class="ok" data-testid="render-saved">Saved to your project.</p>{/if}
        <div class="actions">
          <a class="primary" href={downloadUrl} download={file?.name} data-testid="render-download"><Download size={16} /> Download</a>
          {#if canShare}<button type="button" class="secondary" onclick={share} data-testid="render-share"><Share2 size={16} /> Share</button>{/if}
        </div>
      {:else if busy}
        <button type="button" class="secondary wide" disabled={phase === Phase.Saving} onclick={cancel}>Cancel</button>
      {:else}
        <button type="button" class="primary wide" disabled={!resolution} onclick={start} data-testid="render-start">Render on this device</button>
      {/if}
    {/if}
  {/if}
</main>

<style>
  .render-page {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 560px;
    min-height: 100dvh;
    margin: 0 auto;
    padding: 16px;
    background: var(--ui-bg);
    color: var(--ui-ink);
    font-size: var(--ui-text-sm);
  }

  header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  h1 {
    margin: 0;
    font-size: var(--ui-text-lg, 18px);
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .meta {
    font-family: var(--ui-mono);
    font-size: 11px;
    color: var(--ui-ink-3);
  }

  .stage {
    container-type: size;
    display: flex;
    justify-content: center;
    width: 100%;
    max-height: 56dvh;
    background: var(--ui-hover);
  }

  .choice {
    display: flex;
    gap: 18px;
    margin: 0;
    padding: 0;
    border: 0;
  }

  label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
  }

  .muted {
    margin: 0;
    color: var(--ui-ink-2);
  }

  .notice {
    margin: 0;
    color: var(--ui-ink);
    font-weight: 600;
  }

  .ok {
    margin: 0;
    color: var(--ui-accent);
  }

  .warn {
    margin: 0;
    color: var(--ui-warn);
  }

  .progress {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-family: var(--ui-mono);
    font-size: 12px;
  }

  .track {
    height: 6px;
    background: var(--ui-hover);
  }

  .fill {
    height: 100%;
    background: var(--ui-accent);
    transition: width 120ms linear;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .primary,
  .secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    padding: 0 16px;
    font-size: var(--ui-text-md, 15px);
    font-weight: 600;
  }

  .wide {
    width: 100%;
  }

  .primary {
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
  }

  .primary:disabled {
    background: var(--ui-hover);
    color: var(--ui-ink-3);
  }

  .secondary {
    border: 1px solid var(--ui-line-strong);
  }
</style>
