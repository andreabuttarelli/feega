<script lang="ts">
  import IconButton from './IconButton.svelte';
  import { Action } from '$lib/motion/actions';
  import { onMount } from 'svelte';
  import Download from '@lucide/svelte/icons/download';
  import type { MotionDoc } from '$lib/motion/doc';
  import { Background, FORMATS, formatOf } from '$lib/motion/doc';
  import { Resolution } from '$lib/motion/render-quote';
  import { eta, exportSize, outputSize, type Capabilities, type ExportScope, type Size } from '$lib/motion/export-plan';
  import { audioPlan } from '$lib/motion/audio-plan';
  import { capabilities } from '$lib/motion/export/encode';
  import { BrowserStage, renderInBrowser } from '$lib/motion/export/browser-render';
  import { RenderPlace, renderPlace, thisDevice, type Device } from '$lib/motion/render-place';
  import { saveExport } from '$lib/motion/export/save';
  import type { FrameSize } from './MotionPreview.svelte';
  import { liveComponents, liveNote, unverified } from '$lib/motion/custom/determinism';
  import { CheckState } from '$lib/motion/custom/component';
  import { deserialize } from '$app/forms';
  import { HOLD_BUFFER, renderQuote } from '$lib/motion/render-quote';
  import { EXPORT_FORMATS, ExportFormat, FORMAT, Preset, Quality, estimateBytes, exportProblem, settingsOf, type RenderSettings } from '$lib/motion/export-formats';
  import { FRAME_RATES } from '$lib/motion/design';
  import { setFrameRate } from '$lib/motion/frame-rate';
  import { RenderStage, STALL_AFTER_MS, Stall, framesDone, renderStall, watchProgress, type ProgressWatch, type RenderView, type ServerRender } from '$lib/motion/server-render';
  import type { BrandTokens } from '$lib/motion/brand';
  import type { AudioAnalysis } from '$lib/motion/audio-analysis';
  import InteractiveExport from './InteractiveExport.svelte';
  import { ExportMode } from './export-mode';
  import Film from '@lucide/svelte/icons/film';
  import Code from '@lucide/svelte/icons/code';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';

  type Renderer = (times: number[], size: FrameSize, onFrame: (bitmap: ImageBitmap, index: number) => Promise<void>, signal: AbortSignal) => Promise<void>;

  const Phase = { Checking: 'checking', Ready: 'ready', Mixing: 'mixing', Rendering: 'rendering', Saving: 'saving', Done: 'done', Failed: 'failed' } as const;
  type Phase = (typeof Phase)[keyof typeof Phase];

  const FORMAT_CHOICE: Record<ExportFormat, string> = {
    [ExportFormat.Mp4H264]: 'MP4',
    [ExportFormat.Mp4H265]: 'MP4 HEVC',
    [ExportFormat.Gif]: 'GIF',
    [ExportFormat.WebmAlpha]: 'WebM alpha',
    [ExportFormat.ProRes422]: 'ProRes',
    [ExportFormat.ProRes4444]: 'ProRes alpha',
    [ExportFormat.PngSequence]: 'PNG frames'
  };
  const RESOLUTION_LABEL: Record<Resolution, string> = { [Resolution.P720]: '720p', [Resolution.P1080]: '1080p', [Resolution.P1440]: '1440p', [Resolution.P2160]: '4K' };
  const QUALITY_LABEL: Record<Quality, string> = { [Quality.Standard]: 'Standard', [Quality.High]: 'High' };
  const MODE_TITLE: Record<ExportMode, string> = { [ExportMode.Video]: 'Video file', [ExportMode.Interactive]: 'Embed on a website' };

  const STAGE_LABEL: Record<RenderStage, string> = {
    [RenderStage.Starting]: 'Starting render machines…',
    [RenderStage.Rendering]: 'Rendering frames…',
    [RenderStage.Assembling]: 'Joining video and audio…',
    [RenderStage.Saving]: 'Saving to your assets…',
    [RenderStage.Done]: 'Done',
    [RenderStage.Failed]: 'Failed'
  };
  const SETTLED = new Set(['done', 'failed', 'expired']);
  const POLL_MS = 2000;
  const BYTES_PER_MB = 1024 * 1024;
  const REFUSAL_LABEL: Record<string, string> = {
    save_first: 'Save your changes first: the server renders the saved version.',
    render_in_progress: 'A render of this video is already running.',
    components_unverified: 'A custom component has not passed the seek check.',
    rendering_not_configured: 'Server rendering is not available right now. Use the browser export.',
    credits_exhausted: 'Not enough credits for a server render.',
    render_unavailable: 'The render machines could not start. Try again in a minute.'
  };

  const STALL_LABEL: Record<Stall, string> = {
    [Stall.None]: '',
    [Stall.Slow]: `No progress for ${STALL_AFTER_MS / 60_000} minutes: the render machines may be stuck. Cancel it (held credits come back) or render in this browser.`,
    [Stall.QueueOff]: 'This dev server runs no render queue (DEV_CRONS is off), so this render will not advance. Cancel it, or render in this browser.'
  };

  const PROGRESS_LABEL: Partial<Record<Phase, string>> = {
    [Phase.Mixing]: 'Mixing audio…',
    [Phase.Rendering]: 'Rendering frames…',
    [Phase.Saving]: 'Saving to your assets…'
  };

  let {
    doc,
    assetUrls,
    scope,
    editorUrl,
    fileName,
    render,
    server,
    tokens,
    analyses = {},
    opening = null,
    onpresets,
    onclose
  }: {
    doc: MotionDoc;
    assetUrls: Record<string, string>;
    scope: ExportScope;
    editorUrl: string;
    fileName: string;
    render: Renderer;
    server: ServerRender;
    tokens: BrandTokens;
    analyses?: Record<string, AudioAnalysis>;
    opening?: ExportMode | null;
    onpresets?: () => void;
    onclose: () => void;
  } = $props();

  let background = $state(false);
  let job = $state<RenderView | null>(server.latest && !SETTLED.has(server.latest.status) ? server.latest : null);
  let mode = $state<ExportMode | null>(job ? ExportMode.Video : opening);
  let serverError = $state('');
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let clock = $state(Date.now());
  let watch = $state<ProgressWatch | null>(job ? watchProgress(null, job, clock) : null);

  let settings = $state<RenderSettings>({ ...settingsOf(Preset.Social), fps: doc.fps });
  const target = $derived.by(() => {
    const paced = setFrameRate(doc, settings.fps);
    return paced.ok ? paced.doc : doc;
  });
  const quote = $derived(renderQuote(target, settings.resolution));
  const output = $derived(outputSize(doc, settings.resolution));
  const problem = $derived(exportProblem(target, settings));
  const spec = $derived(FORMAT[settings.format]);
  const megabytes = $derived(Math.max(1, Math.round(estimateBytes(target, settings) / BYTES_PER_MB)));
  const jobRunning = $derived(job !== null && !SETTLED.has(job.status));
  const jobFrames = $derived(job?.progress ? framesDone(job.progress) : 0);
  const jobTotal = $derived(job?.progress?.totalFrames ?? target.durationInFrames);
  const stall = $derived(jobRunning && watch ? renderStall({ watch, queue: server.queue, now: clock }) : Stall.None);

  let phase = $state<Phase>(Phase.Checking);
  let caps = $state<Capabilities | null>(null);
  let device = $state<Device | null>(null);
  let withAudio = $state(true);
  let done = $state(0);
  let startedAt = $state(0);
  let now = $state(0);
  let paused = $state(false);
  let error = $state('');
  let downloadUrl = $state('');
  let savedNote = $state('');
  let controller: AbortController | null = null;

  const total = $derived(target.durationInFrames);
  const sounds = $derived(audioPlan(doc, assetUrls));
  const size = $derived<Size>(exportSize(doc, settings.resolution));
  const remaining = $derived(eta({ done, total, elapsedMs: now - startedAt }));
  const busy = $derived(phase === Phase.Mixing || phase === Phase.Rendering || phase === Phase.Saving);
  const blockers = $derived(unverified(doc));
  const live = $derived(liveComponents(doc));
  const BLOCKER_LABEL: Record<CheckState, string> = { [CheckState.Unchecked]: 'is still being checked', [CheckState.Failed]: 'failed the seek check', [CheckState.Passed]: '' };
  const hasAudio = $derived(withAudio && sounds.length > 0);
  const place = $derived(caps && device ? renderPlace({ doc: target, settings, capabilities: caps, device, background, hasAudio }) : null);
  const onFarm = $derived(place?.place === RenderPlace.Farm || jobRunning);
  const canBack = $derived(mode !== null && !busy && !jobRunning);
  const STAGE_PHASE: Record<BrowserStage, Phase> = { [BrowserStage.Mixing]: Phase.Mixing, [BrowserStage.Rendering]: Phase.Rendering };

  async function postAction(name: string, form: FormData): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await fetch(`${editorUrl}?/${name}`, { method: 'POST', body: form, headers: { 'x-sveltekit-action': 'true' } });
    const result = deserialize(await res.text());
    if (result.type === 'success') {
      return { ok: true, data: (result.data ?? {}) as Record<string, unknown> };
    }
    return { ok: false, data: result.type === 'failure' ? ((result.data ?? {}) as Record<string, unknown>) : { error: 'request_failed' } };
  }

  async function poll() {
    const status = await postAction('renderStatus', new FormData()).catch(() => null);
    const latest = (status?.data.render ?? null) as RenderView | null;
    if (latest && latest.id === job?.id) {
      job = latest;
    }
    clock = Date.now();
    if (job) {
      watch = watchProgress(watch, job, clock);
    }
    if (job && !SETTLED.has(job.status)) {
      pollTimer = setTimeout(poll, POLL_MS);
    }
  }

  async function startServer() {
    serverError = '';
    if (!server.saved) {
      serverError = REFUSAL_LABEL.save_first;
      return;
    }
    const form = new FormData();
    form.set('version', String(server.version));
    form.set('settings', JSON.stringify(settings));
    const started = await postAction('render', form);
    if (!started.ok) {
      const code = String(started.data.error ?? '');
      serverError = String(started.data.detail ?? '') || (REFUSAL_LABEL[code] ?? `Server render refused: ${code}`);
      return;
    }
    job = { id: String(started.data.runId), status: 'running', progress: null, error: null, assetId: null, credits: quote.credits };
    clock = Date.now();
    watch = watchProgress(null, job, clock);
    pollTimer = setTimeout(poll, POLL_MS);
  }

  async function cancelServer() {
    const cancelled = await postAction('cancelRender', new FormData()).catch(() => null);
    if (cancelled?.ok && job) {
      job = { ...job, status: 'failed', error: 'cancelled' };
    }
  }

  async function renderHere() {
    await cancelServer();
    background = false;
  }

  onMount(() => {
    if (jobRunning) {
      pollTimer = setTimeout(poll, POLL_MS);
    }
    device = thisDevice(navigator);
    void capabilities(doc).then((c) => {
      caps = c;
      phase = Phase.Ready;
    });
    return () => {
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
      controller?.abort();
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  });

  function etaLabel(seconds: number | null): string {
    if (seconds === null) {
      return 'estimating…';
    }
    return seconds < 60 ? `about ${seconds}s left` : `about ${Math.ceil(seconds / 60)} min left`;
  }

  async function start() {
    controller = new AbortController();
    const signal = controller.signal;
    error = '';
    done = 0;
    try {
      const blob = await renderInBrowser({
        doc: target,
        assetUrls,
        size,
        withAudio: hasAudio && Boolean(caps?.aac),
        frames: render,
        signal,
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
      downloadUrl = URL.createObjectURL(blob);

      phase = Phase.Saving;
      const saved = await saveExport(blob, { scope, editorUrl, size, seconds: target.durationInFrames / target.fps });
      savedNote = saved.ok ? 'Saved to the canvas assets and attached to this video.' : `Not saved to your assets (${saved.error}). The download below still works.`;
      phase = Phase.Done;
    } catch (e) {
      if (signal.aborted) {
        phase = Phase.Ready;
        return;
      }
      error = e instanceof Error ? e.message : String(e);
      phase = Phase.Failed;
    }
  }

  function cancel() {
    controller?.abort();
  }
</script>

<div class="scrim" role="presentation" onclick={() => !busy && onclose()}></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label="Export" data-testid="export-dialog">
  <header>
    {#if canBack}<IconButton action={Action.Back} onclick={() => (mode = null)} />{/if}
    <h2 class:inset={!canBack}>{mode ? MODE_TITLE[mode] : 'Export'}</h2>
    <IconButton action={Action.Close} disabled={busy} onclick={onclose} />
  </header>

  {#if mode === null}
    <p class="ask">What do you want?</p>
    <div class="choices" role="group" aria-label="What to export">
      <button type="button" class="choice" onclick={() => (mode = ExportMode.Video)} data-testid="export-mode-video">
        <span class="icon"><Film size={20} /></span>
        <b>Video file</b>
        <span class="hint">MP4, GIF, ProRes, transparent WebM. To post or edit.</span>
      </button>
      <button type="button" class="choice" onclick={() => (mode = ExportMode.Interactive)} data-testid="export-mode-interactive">
        <span class="icon"><Code size={20} /></span>
        <b>Embed on a website</b>
        <span class="hint">A live player you paste into your site. It can react to the cursor and scroll.</span>
      </button>
    </div>
  {:else if mode === ExportMode.Interactive}
    <InteractiveExport {doc} {tokens} {assetUrls} {analyses} {fileName} {editorUrl} {onpresets} />
  {:else}
    {@const locked = jobRunning || busy}
    <div class="field">
      <span class="label">Format</span>
      <div class="seg four" role="radiogroup" aria-label="Format" data-testid="export-format">
        {#each EXPORT_FORMATS as format (format)}
          <button type="button" role="radio" aria-checked={settings.format === format} disabled={locked} title={FORMAT[format].label} onclick={() => (settings.format = format)}>{FORMAT_CHOICE[format]}</button>
        {/each}
      </div>
    </div>

    <div class="field">
      <span class="label">Resolution</span>
      <div class="seg" role="radiogroup" aria-label="Resolution" data-testid="export-resolution">
        {#each Object.values(Resolution) as r (r)}
          <button type="button" role="radio" aria-checked={settings.resolution === r} disabled={locked} onclick={() => (settings.resolution = r)}>{RESOLUTION_LABEL[r]}</button>
        {/each}
      </div>
    </div>

    <div class="field">
      <span class="label">Quality</span>
      <div class="seg" role="radiogroup" aria-label="Quality" data-testid="export-quality">
        {#each [Quality.Standard, Quality.High] as q (q)}
          <button type="button" role="radio" aria-checked={settings.quality === q} disabled={locked} onclick={() => (settings.quality = q)}>{QUALITY_LABEL[q]}</button>
        {/each}
      </div>
    </div>

    <div class="summary" data-testid="export-quote">
      <span class="out">{output.width}×{output.height} · {Math.round(quote.seconds)} s · up to ~{megabytes} MB</span>
      {#if !place}
        <span class="hint">Checking what this browser can encode…</span>
      {:else if onFarm}
        {#if place.place === RenderPlace.Farm}<span class="hint" data-testid="export-farm-reason">{place.message}</span>{/if}
        <span class="hint">About {quote.credits} credits on our servers. {Math.ceil(quote.credits * HOLD_BUFFER)} held while it renders; you pay the real time, nothing if it fails.</span>
      {:else}
        <span class="hint">Free. Renders in this tab: keep it open until it finishes.</span>
      {/if}
      {#if spec.alpha && doc.background !== Background.Transparent}<span class="hint">Transparent only where nothing is painted: set the background to Transparent for a see-through file.</span>{/if}
      {#if onFarm && server.uploadLimit}<span class="hint">A saved file can be up to {Math.round(server.uploadLimit / BYTES_PER_MB)} MB.</span>{/if}
    </div>

    <details class="advanced">
      <summary><ChevronRight size={14} /> Advanced</summary>
      <div class="rows">
        <label class="row">
          <span>Frame rate</span>
          <select bind:value={settings.fps} disabled={locked} data-testid="export-fps">
            {#each FRAME_RATES as rate (rate)}<option value={rate}>{rate} fps</option>{/each}
          </select>
        </label>
        <label class="row">
          <span>{sounds.length ? `Audio · ${sounds.length} ${sounds.length === 1 ? 'track' : 'tracks'}` : 'No audio clips'}</span>
          <input type="checkbox" bind:checked={withAudio} disabled={locked || !sounds.length} />
        </label>
        {#if server.configured}
          <label class="row">
            <span>Render on our servers, so you can close this tab (~{quote.credits} credits)</span>
            <input type="checkbox" bind:checked={background} disabled={locked} data-testid="export-background" />
          </label>
        {/if}
        <span class="hint">{FORMAT[settings.format].label} · {FORMATS[formatOf(doc)].label} · {settings.fps} fps</span>
      </div>
    </details>

    {#if job && jobRunning}
      <div class="progress" data-testid="export-progress">
        <div class="track"><div class="fill" style={`width: ${(jobFrames / jobTotal) * 100}%`}></div></div>
        <span>{job.progress ? STAGE_LABEL[job.progress.stage] : STAGE_LABEL[RenderStage.Starting]} {#if job.progress?.stage === RenderStage.Rendering}{jobFrames}/{jobTotal}{/if}</span>
      </div>
      {#if stall !== Stall.None}
        <p class="warn" role="alert" data-testid="export-stalled">{STALL_LABEL[stall]}</p>
        <button type="button" class="secondary" onclick={renderHere} data-testid="export-switch-browser">Render in this browser</button>
      {:else}
        <p class="hint">You can close this tab: the video lands in your assets when it is ready.</p>
      {/if}
      <button type="button" class="link" onclick={cancelServer} data-testid="export-cancel">Cancel render</button>
    {:else if job?.status === 'done' && job.assetId && phase !== Phase.Done}
      <p class="hint" data-testid="export-saved">Saved to the canvas assets and attached to this video.</p>
      <a class="primary" href={server.assetHref(job.assetId)} download={`${fileName}.${spec.ext}`} data-testid="export-download"><Download size={16} /> Download {spec.ext.toUpperCase()}</a>
    {:else}
      {#if job && (job.status === 'failed' || job.status === 'expired')}
        <p class="warn" role="alert" data-testid="export-failed">Server render failed: {job.error ?? job.status}. Nothing was charged.</p>
      {/if}
      {#if serverError}<p class="warn" role="alert">{serverError}</p>{/if}
      {#if live.length}
        <p class="warn" role="alert" data-testid="export-live">{liveNote(live)}. <button type="button" class="link" onclick={() => (mode = ExportMode.Interactive)}>Embed on a website</button></p>
      {/if}

      {#if PROGRESS_LABEL[phase]}
        <div class="progress" data-testid="export-progress">
          <div class="track"><div class="fill" style={`width: ${(done / total) * 100}%`}></div></div>
          <span>{PROGRESS_LABEL[phase]} {#if phase === Phase.Rendering}{done}/{total} · {etaLabel(remaining)}{/if}</span>
        </div>
        {#if paused}<p class="warn" role="alert" data-testid="export-paused">Paused: this tab is in the background. Come back to resume.</p>{/if}
      {/if}
      {#if phase === Phase.Failed}<p class="warn" role="alert">Export failed: {error}</p>{/if}

      {#if phase === Phase.Done}
        <p class="hint" data-testid="export-saved">{savedNote}</p>
        <a class="primary" href={downloadUrl} download={`${fileName}.mp4`} data-testid="export-download"><Download size={16} /> Download MP4</a>
      {:else if busy}
        <button type="button" class="secondary" disabled={phase === Phase.Saving} onclick={cancel}>Cancel</button>
      {:else if blockers.length}
        <p class="warn" role="alert" data-testid="export-blocked">
          Export waits for custom components: {blockers.map((b) => `${b.name} ${BLOCKER_LABEL[b.state]}`).join(', ')}. Fix them in the Code tab or ask the agent.
        </p>
      {:else if problem}
        <p class="warn" role="alert" data-testid="export-problem">{problem}</p>
      {:else if !place}
        <button type="button" class="primary" disabled>Export video</button>
      {:else if place.place === RenderPlace.Browser}
        <button type="button" class="primary" onclick={start} data-testid="export-start">Export video</button>
      {:else if server.configured}
        <button type="button" class="primary" onclick={startServer} disabled={!server.saved} data-testid="export-start-server">{server.saved ? `Export video · ~${quote.credits} credits` : 'Saving your changes…'}</button>
      {:else}
        <p class="warn" role="alert">Server rendering is not available right now: pick MP4 up to 1080p to render it here.</p>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.4);
    z-index: 40;
  }

  .dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(520px, calc(100vw - 32px));
    max-height: calc(100vh - 48px);
    overflow: auto;
    z-index: 41;
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-6);
    padding: 0 var(--ui-space-6) var(--ui-space-6);
    background: var(--ui-raised);
    color: var(--ui-ink);
    box-shadow: 0 24px 64px rgb(0 0 0 / 0.24);
    font-size: var(--ui-text-md);
  }

  header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    min-height: 56px;
    margin: 0 calc(var(--ui-space-2) - var(--ui-space-6)) calc(-1 * var(--ui-space-2));
    background: var(--ui-raised);
  }

  h2 {
    flex: 1;
    margin: 0;
    font-size: var(--ui-text-lg);
    font-weight: 600;
  }

  h2.inset {
    padding-left: calc(var(--ui-space-6) - var(--ui-space-2));
  }

  input[type='checkbox'] {
    accent-color: var(--ui-accent);
  }

  .ask {
    margin: 0;
    color: var(--ui-text-2);
  }

  .choices {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--ui-space-3);
  }

  .choice {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ui-space-2);
    padding: var(--ui-space-6) var(--ui-space-4);
    background: var(--ui-field);
    text-align: left;
    color: var(--ui-ink);
  }

  .choice:hover {
    background: var(--ui-accent-wash);
  }

  .choice:hover .icon {
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
  }

  .choice b {
    font-size: var(--ui-text-lg);
    font-weight: 600;
  }

  .icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    margin-bottom: var(--ui-space-2);
    border-radius: 50%;
    background: var(--ui-raised);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
  }

  .label {
    color: var(--ui-text-3);
    font-size: var(--ui-text-sm);
  }

  .seg {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 2px;
    border: 0;
    background: var(--ui-field);
    padding: 2px;
  }

  .seg.four {
    grid-auto-flow: row;
    grid-template-columns: repeat(4, 1fr);
  }

  .seg button {
    border: 0;
    background: transparent;
    min-height: var(--ui-hit);
    padding: 0 var(--ui-space-2);
    color: var(--ui-text-2);
    font-size: var(--ui-text-sm);
    white-space: nowrap;
  }

  .seg button:hover:not(:disabled) {
    color: var(--ui-ink);
  }

  .seg button[aria-checked='true'] {
    background: var(--ui-raised);
    color: var(--ui-accent);
    font-weight: 600;
  }

  .summary {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-1);
  }

  .out {
    font-family: var(--ui-mono);
    font-size: var(--ui-text-sm);
  }

  .hint {
    margin: 0;
    color: var(--ui-text-2);
    font-size: var(--ui-text-sm);
    line-height: 1.5;
  }

  .advanced summary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: var(--ui-hit);
    color: var(--ui-text-2);
    cursor: pointer;
    list-style: none;
  }

  .advanced summary::-webkit-details-marker {
    display: none;
  }

  .advanced[open] summary :global(svg) {
    transform: rotate(90deg);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    padding-top: var(--ui-space-2);
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--ui-space-4);
    min-height: var(--ui-hit);
    color: var(--ui-text-2);
  }

  select {
    height: var(--ui-hit);
    padding: 0 var(--ui-space-2);
    border: 0;
    background: var(--ui-field);
    color: var(--ui-ink);
    font: inherit;
  }

  select:focus-visible {
    outline: 1px solid var(--ui-accent);
  }

  .warn {
    color: var(--ui-warn);
    margin: 0;
  }

  .progress {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
  }

  .track {
    height: 4px;
    background: var(--ui-hover);
  }

  .fill {
    height: 100%;
    background: var(--ui-accent);
    transition: width 120ms linear;
  }

  .primary,
  .secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    height: 44px;
    padding: 0 var(--ui-space-4);
    font-size: var(--ui-text-md);
    font-weight: 600;
    text-decoration: none;
  }

  .primary {
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
  }

  .primary:disabled {
    background: var(--ui-field);
    color: var(--ui-text-3);
  }

  .secondary {
    background: var(--ui-field);
    color: var(--ui-ink);
  }

  .link {
    align-self: center;
    min-height: var(--ui-hit);
    color: var(--ui-text-2);
    background: none;
  }

  @media (max-width: 640px) {
    .dialog {
      inset: 0;
      transform: none;
      width: 100%;
      max-height: none;
      height: 100dvh;
      padding: 0 var(--ui-space-4) calc(var(--ui-space-6) + env(safe-area-inset-bottom));
      box-shadow: none;
    }

    header {
      margin: 0 calc(var(--ui-space-2) - var(--ui-space-4)) calc(-1 * var(--ui-space-2));
    }

    h2.inset {
      padding-left: calc(var(--ui-space-4) - var(--ui-space-2));
    }

    .choices {
      grid-template-columns: 1fr;
    }
  }
</style>
