<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import Download from '@lucide/svelte/icons/download';
  import Share2 from '@lucide/svelte/icons/share-2';
  import MotionPreview from '$lib/components/motion/MotionPreview.svelte';
  import { composeHtml } from '@feega/motion-core/motion/hyperframes/compose';
  import { audioPlan } from '$lib/motion/audio-plan';
  import { BROWSER_RESOLUTIONS, eta, exportSize, type Capabilities } from '$lib/motion/export-plan';
  import { capabilities } from '$lib/motion/export/encode';
  import { BrowserStage, framesOf, renderInBrowser } from '$lib/motion/export/browser-render';
  import { cancelLink, saveToLink } from '$lib/motion/export/link-upload';
  import { RenderPlace, renderPlace, thisDevice, type Device, type PlaceVerdict } from '$lib/motion/render-place';
  import { Preset, settingsOf } from '$lib/motion/export-formats';
  import { REFUSAL_TEXT, autostarts } from '$lib/motion/render-link';
  import { profileOf } from '$lib/motion/export/capture-profile';
  import { PREVIEW_EVERY_MS, drawOn, tapFrames } from '$lib/motion/export/preview-tap';
  import ExternalLink from '@lucide/svelte/icons/external-link';
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
  const fullDoc = render ? { doc: render.doc, tokens: render.tokens, assets: render.assetUrls, analyses: render.analyses } : null;
  const readsOf = render ? (only?: ReadonlySet<string>) => composeHtml({ doc: render.doc, tokens: render.tokens, assets: render.assetUrls, analyses: render.analyses, only }) : null;
  const span = render ? framesOf(render.doc, render.range) : { from: 0, to: 0 };
  const total = span.to - span.from;
  const seconds = render ? total / render.doc.fps : 0;
  const hasAudio = render ? audioPlan(render.doc, render.assetUrls).length > 0 : false;

  let preview = $state<MotionPreview | null>(null);
  let live = $state<HTMLCanvasElement | null>(null);
  let showing = $state(false);
  let phase = $state<Phase>(Phase.Checking);
  let caps = $state<Capabilities | null>(null);
  let device = $state<Device | null>(null);
  let resolution = $state<Resolution | null>(null);
  let blocked = $state('');
  let done = $state(0);
  let startedAt = $state(0);
  let now = $state(0);
  let error = $state('');
  let file = $state<File | null>(null);
  let downloadUrl = $state('');
  let controller: AbortController | null = null;

  const percent = $derived(Math.floor((done / Math.max(1, total)) * 100));
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

  let autostarted = false;

  $effect(() => {
    if (autostarted || phase !== Phase.Ready || !preview || !autostarts(page.url.searchParams)) {
      return;
    }
    autostarted = true;
    void start();
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
    showing = false;
    const size = exportSize(render.doc, resolution);
    try {
      const blob = await renderInBrowser({
        doc: render.doc,
        assetUrls: render.assetUrls,
        size,
        quality: render.quality,
        withAudio: Boolean(caps?.aac),
        range: render.range,
        frames: tapFrames(
          (times, s, onFrame, signal) => preview!.render(times, s, onFrame, signal, html, profileOf(page.url.searchParams.get(CAPTURE_PARAM))),
          (bitmap) => {
            drawOn(live)(bitmap);
            showing = true;
          },
          { everyMs: PREVIEW_EVERY_MS, now: () => performance.now() }
        ),
        signal: controller.signal,
        onStage: (stage) => {
          phase = STAGE_PHASE[stage];
          startedAt = performance.now();
        },
        onFrame: (n) => {
          done = n;
          now = performance.now();
        }
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
  <section class="card">
    {#if data.refused}
      <h1>render</h1>
      <p class="warn" role="alert" data-testid="render-refused">{REFUSAL_TEXT[data.refused]}</p>
    {:else if render}
      <header>
        <h1>{render.name.toLowerCase()}</h1>
        <span class="meta">v{render.revision} · {+seconds.toFixed(2)} s · {render.doc.fps} fps · {render.doc.width}×{render.doc.height}</span>
      </header>

      <div class="stage" style={`aspect-ratio: ${render.doc.width} / ${render.doc.height}`}>
        <MotionPreview bind:this={preview} {html} {fullDoc} gpuCompose={readsOf} width={render.doc.width} height={render.doc.height} fps={render.doc.fps} />
        <canvas bind:this={live} class="live" class:on={showing} data-testid="render-live" aria-hidden="true"></canvas>
        {#if phase === Phase.Done && downloadUrl}<video class="live on" src={downloadUrl} autoplay muted loop playsinline controls data-testid="render-result"></video>{/if}
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
          <div class="segments" role="radiogroup" aria-label="Resolution">
            {#each allowed as r (r)}
              <label class:picked={resolution === r}><input type="radio" name="res" value={r} bind:group={resolution} />{r}</label>
            {/each}
          </div>
          <p class="muted">Free: it renders on this device and saves to your project. Keep this screen on until it finishes.</p>
        {/if}

        {#if PHASE_LABEL[phase]}
          <div class="progress" data-testid="render-progress">
            <div class="readout">
              <span class="percent">{phase === Phase.Rendering ? percent : phase === Phase.Saving ? 100 : 0}%</span>
              <span class="left">{phase === Phase.Rendering ? etaLabel(remaining) : PHASE_LABEL[phase]}</span>
            </div>
            <div class="track"><div class="fill" style={`width: ${phase === Phase.Saving ? 100 : (done / Math.max(1, total)) * 100}%`}></div></div>
            <div class="sub">
              <span>{PHASE_LABEL[phase]}</span>
              {#if phase === Phase.Rendering}<span class="frames">{done}/{total} frames</span>{/if}
            </div>
          </div>
          <p class="notice" role="status">Keep this screen on and this tab open.</p>
        {/if}

        {#if phase === Phase.Failed}<p class="warn" role="alert">Render failed: {error}</p>{/if}

        {#if phase === Phase.Done}
          {#if error}<p class="warn" role="alert">{error}</p>{:else}<p class="ok" data-testid="render-saved">Saved to your project.</p>{/if}
          <div class="actions">
            <a class="button primary" href={downloadUrl} download={file?.name} data-testid="render-download"><Download size={16} /> Download</a>
            <a class="button secondary" href={downloadUrl} target="_blank" rel="noopener" data-testid="render-open"><ExternalLink size={16} /> Open</a>
            {#if canShare}<button type="button" class="button secondary" onclick={share} data-testid="render-share"><Share2 size={16} /> Share</button>{/if}
          </div>
        {:else if busy}
          <button type="button" class="button secondary" disabled={phase === Phase.Saving} onclick={cancel}>Cancel</button>
        {:else}
          <button type="button" class="button primary" disabled={!resolution} onclick={start} data-testid="render-start">Render on this device</button>
        {/if}
      {/if}
    {/if}
  </section>
</main>

<style>
  .render-page {
    display: grid;
    place-items: center;
    min-height: 100dvh;
    padding: var(--ui-space-6, 24px) 16px;
    box-sizing: border-box;
    background: var(--ui-canvas);
    color: var(--ui-text);
    font-size: var(--ui-text-md, 13px);
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    max-width: 640px;
    padding: 28px;
    box-sizing: border-box;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel);
    box-shadow: var(--ui-shadow-float);
  }

  header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  h1 {
    margin: 0;
    font-size: clamp(36px, 10vw, 56px);
    font-weight: 600;
    letter-spacing: -0.04em;
    line-height: 0.95;
    overflow-wrap: anywhere;
  }

  .meta,
  .frames {
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs, 11px);
    font-variant-numeric: tabular-nums;
    color: var(--ui-text-3);
  }

  .stage {
    position: relative;
    container-type: size;
    display: flex;
    justify-content: center;
    align-self: center;
    width: 100%;
    max-height: 56dvh;
    overflow: hidden;
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel-sunken);
  }

  .live {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    opacity: 0;
    transition: opacity 200ms var(--ui-ease);
  }

  .live.on {
    opacity: 1;
  }

  .segments {
    display: flex;
    padding: 2px;
    gap: 2px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
  }

  .segments label {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    border-radius: var(--ui-radius-sm);
    color: var(--ui-text-2);
    font-weight: 500;
    cursor: pointer;
  }

  .segments label.picked {
    background: var(--ui-panel-raised);
    color: var(--ui-text);
    box-shadow: var(--ui-shadow-float);
  }

  .segments input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .segments label:focus-within {
    box-shadow: var(--ui-ring);
  }

  .muted {
    margin: 0;
    color: var(--ui-text-2);
  }

  .notice {
    margin: 0;
    color: var(--ui-text-2);
  }

  .ok {
    margin: 0;
    color: var(--ui-accent-text);
  }

  .warn {
    margin: 0;
    color: var(--ui-warn);
  }

  .progress {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .readout {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .percent {
    font-size: clamp(40px, 9vw, 56px);
    font-weight: 600;
    letter-spacing: -0.04em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .left {
    color: var(--ui-text-2);
    font-size: var(--ui-text-lg, 15px);
  }

  .track {
    height: 8px;
    overflow: hidden;
    border-radius: var(--ui-radius-full, 999px);
    background: var(--ui-input);
  }

  .fill {
    height: 100%;
    border-radius: inherit;
    background: var(--ui-accent-solid);
    transition: width 200ms var(--ui-ease);
  }

  .sub {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: var(--ui-text-3);
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
  }

  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 16px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    font: inherit;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: background 120ms var(--ui-ease);
  }

  .button:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  .primary {
    background: var(--ui-accent-solid);
    color: var(--ui-accent-ink, #fff);
  }

  .secondary {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .secondary:hover:not(:disabled) {
    background: var(--ui-pressed);
  }

  .button:disabled {
    background: var(--ui-input);
    color: var(--ui-text-3);
    cursor: default;
  }

  @media (max-width: 480px) {
    .card {
      padding: 20px;
      gap: 16px;
    }
  }
</style>
