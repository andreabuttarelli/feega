<script lang="ts">
  import { onMount } from 'svelte';
  import X from '@lucide/svelte/icons/x';
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
  import { unverified } from '$lib/motion/custom/determinism';
  import { CheckState } from '$lib/motion/custom/component';
  import { deserialize } from '$app/forms';
  import { HOLD_BUFFER, renderQuote } from '$lib/motion/render-quote';
  import { EXPORT_FORMATS, FORMAT, PRESETS, Preset, Quality, estimateBytes, exportProblem, settingsOf, type RenderSettings } from '$lib/motion/export-formats';
  import { FRAME_RATES } from '$lib/motion/design';
  import { setFrameRate } from '$lib/motion/frame-rate';
  import { RenderStage, framesDone, type RenderView, type ServerRender } from '$lib/motion/server-render';
  import type { BrandTokens } from '$lib/motion/brand';
  import type { AudioAnalysis } from '$lib/motion/audio-analysis';
  import InteractiveExport from './InteractiveExport.svelte';

  type Renderer = (times: number[], size: FrameSize, onFrame: (bitmap: ImageBitmap, index: number) => Promise<void>, signal: AbortSignal) => Promise<void>;

  const Phase = { Checking: 'checking', Ready: 'ready', Mixing: 'mixing', Rendering: 'rendering', Saving: 'saving', Done: 'done', Failed: 'failed' } as const;
  type Phase = (typeof Phase)[keyof typeof Phase];

  const Mode = { Video: 'video', Interactive: 'interactive' } as const;
  type Mode = (typeof Mode)[keyof typeof Mode];

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
    onclose: () => void;
  } = $props();

  let mode = $state<Mode>(Mode.Video);
  let background = $state(false);
  let job = $state<RenderView | null>(server.latest && !SETTLED.has(server.latest.status) ? server.latest : null);
  let serverError = $state('');
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  let settings = $state<RenderSettings>({ ...settingsOf(Preset.Social), fps: doc.fps });
  const SETTING_KEYS = ['format', 'fps', 'quality', 'resolution'] as const;
  const isPreset = (preset: Preset) => SETTING_KEYS.every((k) => settingsOf(preset)[k] === settings[k]);
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
  const BLOCKER_LABEL: Record<CheckState, string> = { [CheckState.Unchecked]: 'is still being checked', [CheckState.Failed]: 'failed the seek check', [CheckState.Passed]: '' };
  const hasAudio = $derived(withAudio && sounds.length > 0);
  const place = $derived(caps && device ? renderPlace({ doc: target, settings, capabilities: caps, device, background, hasAudio }) : null);
  const onFarm = $derived(place?.place === RenderPlace.Farm || jobRunning);
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
    pollTimer = setTimeout(poll, POLL_MS);
  }

  async function cancelServer() {
    const cancelled = await postAction('cancelRender', new FormData()).catch(() => null);
    if (cancelled?.ok && job) {
      job = { ...job, status: 'failed', error: 'cancelled' };
    }
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
<div class="dialog" role="dialog" aria-modal="true" aria-label="Export video" data-testid="export-dialog">
  <header>
    <span>Export</span>
    <button type="button" aria-label="Close" disabled={busy} onclick={onclose}><X size={16} /></button>
  </header>

  <div class="choice modes" role="radiogroup" aria-label="What to export">
    <label><input type="radio" name="mode" value={Mode.Video} bind:group={mode} disabled={busy} data-testid="export-mode-video" /> Video</label>
    <label><input type="radio" name="mode" value={Mode.Interactive} bind:group={mode} disabled={busy} data-testid="export-mode-interactive" /> Interactive (web)</label>
  </div>

  {#if mode === Mode.Interactive}
    <InteractiveExport {doc} {tokens} {assetUrls} {analyses} {fileName} />
  {:else}
    <dl>
      <dt>Preset</dt>
      <dd class="presets" data-testid="export-presets">
        {#each Object.values(Preset) as preset (preset)}
          {@const [name, detail] = PRESETS[preset].label.split(' · ')}
          <button type="button" class="preset" aria-pressed={isPreset(preset)} disabled={jobRunning || busy} onclick={() => (settings = settingsOf(preset))}><b>{name}</b><span>{detail}</span></button>
        {/each}
      </dd>
      <dt>File</dt>
      <dd>
        <select bind:value={settings.format} disabled={jobRunning || busy} data-testid="export-format">
          {#each EXPORT_FORMATS as format (format)}<option value={format}>{FORMAT[format].label}</option>{/each}
        </select>
      </dd>
      <dt>Frame rate</dt>
      <dd>
        <select bind:value={settings.fps} disabled={jobRunning || busy} data-testid="export-fps">
          {#each FRAME_RATES as rate (rate)}<option value={rate}>{rate} fps</option>{/each}
        </select>
      </dd>
      <dt>Resolution</dt>
      <dd>
        <select bind:value={settings.resolution} disabled={jobRunning || busy} data-testid="export-resolution">
          {#each Object.values(Resolution) as r (r)}<option value={r}>{r === Resolution.P2160 ? '4K (2160p)' : r}</option>{/each}
        </select>
      </dd>
      <dt>Quality</dt>
      <dd class="choice">
        <label><input type="radio" name="quality" value={Quality.High} bind:group={settings.quality} disabled={jobRunning || busy} /> High</label>
        <label><input type="radio" name="quality" value={Quality.Standard} bind:group={settings.quality} disabled={jobRunning || busy} /> Standard</label>
      </dd>
      <dt>Audio</dt>
      <dd>
        {#if !sounds.length}
          <span class="muted">No audio clips</span>
        {:else}
          <label><input type="checkbox" bind:checked={withAudio} disabled={busy || jobRunning} /> {sounds.length} {sounds.length === 1 ? 'track' : 'tracks'} mixed in</label>
        {/if}
      </dd>
      <dt>Output</dt>
      <dd>
        {FORMATS[formatOf(doc)].label} · {output.width}×{output.height} · {settings.fps} fps · {Math.round(quote.seconds)} s · up to ~{megabytes} MB{#if onFarm && server.uploadLimit} (a saved file can be {Math.round(server.uploadLimit / BYTES_PER_MB)} MB){/if}
        {#if spec.alpha && doc.background !== Background.Transparent}<br /><span class="muted">Keeps alpha only where nothing is painted: set the background to Transparent for a see-through file.</span>{/if}
      </dd>
      {#if server.configured}
        <dt>Where</dt>
        <dd>
          <label><input type="checkbox" bind:checked={background} disabled={busy || jobRunning} data-testid="export-background" /> Render in the background: you can close this tab (~{quote.credits} credits)</label>
        </dd>
      {/if}
      <dt>Cost</dt>
      <dd data-testid="export-quote">
        {#if !place}
          <span class="muted">Checking what this browser can encode…</span>
        {:else if onFarm}
          {#if place.place === RenderPlace.Farm}<span data-testid="export-farm-reason">{place.message}</span><br />{/if}
          About {quote.credits} credits. {Math.ceil(quote.credits * HOLD_BUFFER)} are held while it renders; you pay the time it really takes, never more than held, nothing if it fails.
        {:else}
          Free: it renders in this tab. Keep it open and the screen on until it finishes.
        {/if}
      </dd>
    </dl>

    {#if job && jobRunning}
      <div class="progress" data-testid="export-progress">
        <div class="track"><div class="fill" style={`width: ${(jobFrames / jobTotal) * 100}%`}></div></div>
        <span>{job.progress ? STAGE_LABEL[job.progress.stage] : STAGE_LABEL[RenderStage.Starting]} {#if job.progress?.stage === RenderStage.Rendering}{jobFrames}/{jobTotal}{/if}</span>
      </div>
      <p class="muted">You can close this tab: the video lands in your assets when it is ready.</p>
      <button type="button" onclick={cancelServer} data-testid="export-cancel">Cancel render</button>
    {:else if job?.status === 'done' && job.assetId && phase !== Phase.Done}
      <p class="muted" data-testid="export-saved">Saved to the canvas assets and attached to this video.</p>
      <a class="primary" href={server.assetHref(job.assetId)} download={`${fileName}.${spec.ext}`} data-testid="export-download"><Download size={14} /> Download {spec.ext.toUpperCase()}</a>
    {:else}
      {#if job && (job.status === 'failed' || job.status === 'expired')}
        <p class="warn" role="alert" data-testid="export-failed">Server render failed: {job.error ?? job.status}. Nothing was charged.</p>
      {/if}
      {#if serverError}<p class="warn" role="alert">{serverError}</p>{/if}

      {#if PROGRESS_LABEL[phase]}
        <div class="progress" data-testid="export-progress">
          <div class="track"><div class="fill" style={`width: ${(done / total) * 100}%`}></div></div>
          <span>{PROGRESS_LABEL[phase]} {#if phase === Phase.Rendering}{done}/{total} · {etaLabel(remaining)}{/if}</span>
        </div>
        {#if paused}<p class="warn" role="alert" data-testid="export-paused">Paused: this tab is in the background. Come back to resume.</p>{/if}
      {/if}
      {#if phase === Phase.Failed}<p class="warn" role="alert">Export failed: {error}</p>{/if}

      {#if phase === Phase.Done}
        <p class="muted" data-testid="export-saved">{savedNote}</p>
        <a class="primary" href={downloadUrl} download={`${fileName}.mp4`} data-testid="export-download"><Download size={14} /> Download MP4</a>
      {:else if busy}
        <button type="button" class="secondary" disabled={phase === Phase.Saving} onclick={cancel}>Cancel</button>
      {:else if blockers.length}
        <p class="warn" role="alert" data-testid="export-blocked">
          Export waits for custom components: {blockers.map((b) => `${b.name} ${BLOCKER_LABEL[b.state]}`).join(', ')}. Fix them in the Code tab or ask the agent.
        </p>
      {:else if problem}
        <p class="warn" role="alert" data-testid="export-problem">{problem}</p>
      {:else if !place}
        <button type="button" class="primary" disabled>Export</button>
      {:else if place.place === RenderPlace.Browser}
        <button type="button" class="primary" onclick={start} data-testid="export-start">Export {settings.resolution} · free</button>
      {:else if server.configured}
        <button type="button" class="primary" onclick={startServer} disabled={!server.saved} data-testid="export-start-server">{server.saved ? `Render on our servers · ~${quote.credits} credits` : 'Saving your changes…'}</button>
      {:else}
        <p class="warn" role="alert">Server rendering is not available right now: pick MP4 H.264 up to 1080p to render it here.</p>
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
    gap: 14px;
    padding: 0 16px 16px;
    background: var(--ui-bg);
    color: var(--ui-ink);
    border: 1px solid var(--ui-line-strong);
    box-shadow: 0 24px 64px rgb(0 0 0 / 0.24);
    font-size: var(--ui-text-sm);
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 44px;
    margin: 0 -16px;
    padding: 0 8px 0 16px;
    border-bottom: 1px solid var(--ui-line);
    font-size: var(--ui-text-md);
    font-weight: 600;
  }

  header button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    color: var(--ui-ink-2);
  }

  header button:hover {
    background: var(--ui-hover);
  }

  dl {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    align-items: center;
    gap: 8px 12px;
    margin: 0;
  }

  dt {
    color: var(--ui-ink-2);
    align-self: start;
    padding-top: 4px;
  }

  dd {
    margin: 0;
    min-width: 0;
  }

  select {
    width: 100%;
    height: 26px;
    padding: 0 6px;
    border: 1px solid var(--ui-line-strong);
    border-radius: 0;
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
  }

  select:focus-visible {
    outline: none;
    border-color: var(--ui-accent);
  }

  .choice {
    display: flex;
    gap: 14px;
  }

  label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .modes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    margin-top: 2px;
    border: 1px solid var(--ui-line-strong);
  }

  .modes label {
    justify-content: center;
    height: 30px;
    color: var(--ui-ink-2);
    cursor: pointer;
  }

  .modes label + label {
    border-left: 1px solid var(--ui-line-strong);
  }

  .modes input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .modes label:has(input:checked) {
    background: var(--ui-accent-wash);
    color: var(--ui-accent);
    font-weight: 600;
  }

  .modes label:has(input:focus-visible) {
    outline: 1px solid var(--ui-accent);
    outline-offset: -1px;
  }

  .presets {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--ui-line);
  }

  .preset {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 40px;
    padding: 0 12px;
    border-left: 2px solid transparent;
    text-align: left;
  }

  .preset + .preset {
    border-top: 1px solid var(--ui-line);
  }

  .preset:hover:not(:disabled) {
    background: var(--ui-hover);
  }

  .preset[aria-pressed='true'] {
    background: var(--ui-accent-wash);
    border-left-color: var(--ui-accent);
  }

  .preset b {
    font-size: var(--ui-text-sm);
    font-weight: 600;
  }

  .preset span {
    font-family: var(--ui-mono);
    font-size: 10px;
    color: var(--ui-ink-3);
  }

  .muted {
    color: var(--ui-ink-2);
    margin: 0;
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
    font-size: 11px;
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
    gap: 6px;
    align-self: flex-end;
    height: 30px;
    padding: 0 14px;
    font-size: var(--ui-text-sm);
    font-weight: 600;
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
