<script lang="ts">
  import PageTitle from '$lib/components/PageTitle.svelte';
  import { onDestroy } from 'svelte';
  import { deserialize } from '$app/forms';
  import { goto, invalidateAll } from '$app/navigation';
  import PageHead from '$lib/components/PageHead.svelte';
  import BeforeAfter from '$lib/components/upscale/BeforeAfter.svelte';
  import { createSupabaseBrowserClient } from '$lib/supabase/client';
  import { canvasUploadPrefix } from '$lib/canvas/upload-kind';
  import { planUpscale, quoteUpscale, upscaleSteps, UPSCALE_MODES, UPSCALE_REFUSAL_TEXT, UPSCALE_TARGETS, UpscaleJobStatus, UpscaleMode, UpscaleStep, UpscaleTarget } from '$lib/upscale';

  type Probe = { width: number; height: number; seconds: number; bytes: number; mimeType: string };
  type Picked = { kind: 'upload'; file: File; previewUrl: string } | { kind: 'asset'; id: string; previewUrl: string };

  const POLL_MS = 5000;
  const BYTES_PER_MB = 1024 * 1024;
  const SAMPLE = { before: '/upscaler/sample-before.mp4', after: '/upscaler/sample-after.mp4', poster: '/upscaler/sample-poster.webp' };

  let { data } = $props();

  const supabase = createSupabaseBrowserClient();
  let picked = $state<Picked | null>(null);
  let probe = $state<Probe | null>(null);
  let target = $state<UpscaleTarget>(UpscaleTarget.Double);
  let mode = $state<UpscaleMode>(UpscaleMode.Precise);
  let busy = $state(false);
  let failure = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);
  let step = $state<UpscaleStep | null>(null);
  let dragging = $state(false);

  const plan = $derived(probe ? planUpscale(probe, target, data.limits) : null);
  const quote = $derived(plan?.ok && probe ? quoteUpscale(plan, probe.seconds, data.pricing, mode) : null);
  const refusal = $derived(plan && !plan.ok ? UPSCALE_REFUSAL_TEXT[plan.error] : null);
  const job = $derived(data.job);
  const shownStep = $derived(step ?? (job?.status === UpscaleJobStatus.Running ? UpscaleStep.Upscaling : job?.status === UpscaleJobStatus.Done ? UpscaleStep.Done : null));
  const steps = $derived(shownStep ? upscaleSteps(shownStep) : []);
  const megabytes = (bytes: number) => `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;

  const poll = setInterval(() => {
    if (job?.status === 'running') {
      void invalidateAll();
    }
  }, POLL_MS);
  onDestroy(() => clearInterval(poll));

  function readProbe(url: string, bytes: number, mimeType: string): Promise<Probe> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight, seconds: video.duration, bytes, mimeType });
      video.onerror = () => resolve({ width: 0, height: 0, seconds: 0, bytes, mimeType });
      video.src = url;
    });
  }

  async function pickFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    await useFile(file);
  }

  async function dropFile(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    await useFile(e.dataTransfer?.files?.[0]);
  }

  function dragOver(e: DragEvent) {
    e.preventDefault();
    dragging = true;
  }

  function clearPick() {
    picked = null;
    probe = null;
    failure = null;
  }

  async function useFile(file: File | undefined) {
    if (!file || busy) {
      return;
    }
    failure = null;
    const previewUrl = URL.createObjectURL(file);
    picked = { kind: 'upload', file, previewUrl };
    probe = await readProbe(previewUrl, file.size, file.type);
  }

  async function pickAsset(asset: { id: string; bytes: number | null; url: string | null }) {
    if (!asset.url) {
      return;
    }
    failure = null;
    picked = { kind: 'asset', id: asset.id, previewUrl: asset.url };
    probe = await readProbe(asset.url, asset.bytes ?? 0, 'video/mp4');
  }

  async function uploadFields(file: File): Promise<Record<string, string> | null> {
    const path = `${canvasUploadPrefix(data.orgId, data.projectId)}${crypto.randomUUID()}-${file.name}`;
    const up = await supabase.storage.from('canvas-assets').upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) {
      failure = up.error.message;
      return null;
    }
    return { source: 'upload', path, file_name: file.name, mime_type: file.type, bytes: String(file.size) };
  }

  async function start() {
    if (!picked || !probe || !plan?.ok) {
      return;
    }
    busy = true;
    failure = null;
    step = picked.kind === 'upload' ? UpscaleStep.Uploading : UpscaleStep.Starting;
    try {
      const sourceFields = picked.kind === 'upload' ? await uploadFields(picked.file) : { source: 'asset', asset_id: picked.id };
      if (!sourceFields) {
        return;
      }
      step = UpscaleStep.Starting;

      const body = new FormData();
      const fields = { ...sourceFields, project: data.projectId, width: String(probe.width), height: String(probe.height), seconds: String(probe.seconds), target, mode };
      for (const [k, v] of Object.entries(fields)) {
        body.set(k, v);
      }
      const res = await fetch('?/start', { method: 'POST', headers: { 'x-sveltekit-action': 'true' }, body });
      const result = deserialize(await res.text());
      if (result.type === 'redirect') {
        picked = null;
        probe = null;
        await goto(result.location, { invalidateAll: true });
        return;
      }
      failure = result.type === 'failure' ? String(result.data?.error ?? 'Something went wrong.') : 'Something went wrong.';
    } finally {
      busy = false;
      step = null;
    }
  }
</script>

<PageHead title="AI Video Upscaler" subtitle="Upscale a clip to 2× or 4K with FLUX Video Upscale. MP4 up to 20 s, 1440p and 50 MB." />

<div class="upscale">
  <header class="head">
    <PageTitle text="upscale a video" />
    <p class="lede">Sharper frames, same motion. MP4 up to {data.limits.maxInputSeconds} s and 1440p.</p>
  </header>

  <div class="layout">
    <main class="stage">
      {#if job && job.status !== UpscaleJobStatus.Running}
        <section class="result" data-testid="upscale-job" data-status={job.status}>
          {#if job.status === UpscaleJobStatus.Failed}
            <p class="error">The upscale failed: {job.error ?? 'no result'}. Pick the clip again to retry.</p>
          {:else if job.beforeUrl && job.afterUrl}
            <BeforeAfter before={job.beforeUrl} after={job.afterUrl} />
            <div class="row">
              <a class="primary" href={job.afterUrl} download>Download</a>
              <a class="ghost" href={job.canvasHref}>Open on the canvas</a>
              <a class="ghost" href={`/app/upscale?project=${data.projectId}`}>Upscale another</a>
            </div>
            <p class="muted">Saved to this project's assets, marked as AI-generated.</p>
          {/if}
        </section>
      {:else if picked}
        <section class="source" data-testid="upscale-source">
          <video src={picked.previewUrl} controls muted playsinline preload="metadata"></video>
          <div class="row meta">
            <span class="mono">{probe ? `${probe.width}×${probe.height} · ${probe.seconds.toFixed(1)} s${probe.bytes ? ` · ${megabytes(probe.bytes)}` : ''}` : 'Reading…'}</span>
            <button type="button" class="ghost" onclick={clearPick} disabled={busy}>Change clip</button>
          </div>
        </section>
      {:else if job}
        <section class="running" data-testid="upscale-job" data-status={job.status}>
          <div class="shimmer"></div>
        </section>
      {:else}
        <button
          type="button"
          class="drop"
          class:dragging
          data-testid="upscale-drop"
          onclick={() => fileInput?.click()}
          ondragover={dragOver}
          ondragleave={() => (dragging = false)}
          ondrop={dropFile}
        >
          <span class="drop-title">drop an mp4 here</span>
          <span class="muted">or click to choose a file · up to {data.limits.maxInputSeconds} s, {megabytes(data.limits.maxInputBytes)}</span>
        </button>
      {/if}
      <input bind:this={fileInput} type="file" accept="video/mp4" hidden onchange={pickFile} />

      {#if steps.length}
        <ol class="steps" data-testid="upscale-steps">
          {#each steps as s (s.id)}
            <li class={s.state}><span class="dot"></span>{s.label}</li>
          {/each}
        </ol>
        {#if job?.status === UpscaleJobStatus.Running}
          <p class="muted">This takes a few minutes. You can leave: the result lands on the <a href={job.canvasHref}>Upscale canvas</a> and in the list below.</p>
        {/if}
      {/if}

      {#if !picked && !job && data.library.length}
        <section>
          <h2>from this project</h2>
          <div class="tiles">
            {#each data.library as asset (asset.id)}
              <button type="button" class="tile" onclick={() => pickAsset(asset)} aria-label="Use this video">
                {#if asset.url}<video src={asset.url} muted preload="metadata"></video>{/if}
              </button>
            {/each}
          </div>
        </section>
      {/if}

      {#if !picked && !job}
        <section>
          <h2>example <span class="muted">854×480 → 1708×960 · Big Buck Bunny © Blender Foundation, CC BY 3.0</span></h2>
          <BeforeAfter before={SAMPLE.before} after={SAMPLE.after} poster={SAMPLE.poster} label="Example: a 480p clip and its 2× upscale" />
        </section>
      {/if}
    </main>

    <aside class="panel">
      <section>
        <h2>size</h2>
        <div class="seg">
          {#each UPSCALE_TARGETS as t (t.id)}
            <button type="button" class:on={target === t.id} aria-pressed={target === t.id} onclick={() => (target = t.id)}>{t.label}</button>
          {/each}
        </div>
      </section>

      <section>
        <h2>mode</h2>
        <div class="seg">
          {#each UPSCALE_MODES as m (m.id)}
            <button type="button" class:on={mode === m.id} aria-pressed={mode === m.id} onclick={() => (mode = m.id)}>{m.label}</button>
          {/each}
        </div>
        <p class="muted hint">{UPSCALE_MODES.find((m) => m.id === mode)?.hint}</p>
      </section>

      <section class="quote" data-testid="upscale-quote">
        {#if refusal}
          <p class="error">{refusal}</p>
        {:else if plan?.ok && probe}
          <p class="mono">{probe.width}×{probe.height} → <strong>{plan.width}×{plan.height}</strong> · {plan.factor}×</p>
          <p class="cost">{quote?.credits != null ? `${quote.credits} credits` : 'Price shown after the run'}</p>
          <p class="muted">Balance {data.balance} credits</p>
        {:else}
          <p class="muted">Pick a clip to see the output size and the cost.</p>
        {/if}
      </section>

      {#if failure}<p class="error">{failure}</p>{/if}

      <button type="button" class="primary wide" data-testid="upscale-start" disabled={busy || !plan?.ok} onclick={start}>
        {busy ? (step === UpscaleStep.Uploading ? 'Uploading…' : 'Starting…') : 'Upscale'}
      </button>
    </aside>
  </div>

  {#if data.history.length}
    <section data-testid="upscale-history">
      <h2>recent upscales</h2>
      <div class="tiles">
        {#each data.history as h (h.nodeId)}
          <a class="item" class:current={job?.nodeId === h.nodeId} href={`/app/upscale?project=${data.projectId}&job=${h.nodeId}`}>
            <span class="thumb">{#if h.afterUrl ?? h.beforeUrl}<video src={h.afterUrl ?? h.beforeUrl} muted preload="metadata"></video>{/if}</span>
            <span class="caption"><span class="dot {h.status}"></span>{h.factor ? `${h.factor}× · ` : ''}{h.status}</span>
          </a>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .upscale { max-width: var(--content-max, 1100px); margin: 0 auto; padding: 0 16px 48px; display: flex; flex-direction: column; gap: 32px; }
  .head { display: flex; flex-direction: column; gap: 8px; padding-top: 24px; }
  .lede { margin: 0; color: var(--ui-ink-3); font-size: var(--ui-text-md); }
  h2 { font-size: var(--ui-text-sm); font-weight: 600; margin: 0 0 8px; color: var(--ui-ink-2); }
  .muted { color: var(--ui-ink-3); font-size: var(--ui-text-sm); font-weight: 400; margin: 0; }
  .hint { margin-top: 8px; }
  .mono { font-family: var(--ui-mono); font-size: var(--ui-text-sm); }
  .error { color: var(--ui-danger); font-size: var(--ui-text-sm); margin: 0; }

  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 32px; align-items: start; }
  .stage { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
  .panel { position: sticky; top: 16px; display: flex; flex-direction: column; gap: 20px; padding: 20px; background: var(--ui-surface); }

  .drop { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; aspect-ratio: 16 / 9; width: 100%; background: var(--ui-surface); border: 1px dashed var(--ui-line-strong); color: var(--ui-ink); cursor: pointer; padding: 16px; text-align: center; }
  .drop:hover, .drop.dragging { background: var(--ui-accent-wash); border-color: var(--ui-accent); }
  .drop-title { font-size: clamp(28px, 4vw, 44px); font-weight: 600; letter-spacing: -0.04em; line-height: 0.95; }

  .source video { width: 100%; aspect-ratio: 16 / 9; background: #000; display: block; object-fit: contain; }
  .meta { justify-content: space-between; margin-top: 8px; }
  .shimmer { aspect-ratio: 16 / 9; background: linear-gradient(90deg, var(--ui-surface) 0%, var(--ui-hover) 50%, var(--ui-surface) 100%); background-size: 200% 100%; animation: shimmer 1.4s linear infinite; }
  @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

  .steps { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; font-size: var(--ui-text-md); }
  .steps li { display: flex; align-items: center; gap: 10px; color: var(--ui-ink-3); }
  .steps li.active { color: var(--ui-ink); font-weight: 600; }
  .steps li.done { color: var(--ui-ink-2); }
  .dot { width: 8px; height: 8px; border-radius: 9999px; background: var(--ui-line-strong); flex: none; }
  .steps .active .dot, .dot.running { background: var(--ui-accent); }
  .steps .active .dot { animation: pulse 0.9s ease-in-out infinite alternate; }
  .steps .done .dot, .dot.done { background: var(--ui-ok); }
  .dot.failed { background: var(--ui-danger); }
  @keyframes pulse { to { opacity: 0.3; } }

  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .result { display: flex; flex-direction: column; gap: 12px; }
  .seg { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; background: var(--ui-bg); }
  .seg button { min-height: 44px; border: 0; background: transparent; color: var(--ui-ink-2); font-size: var(--ui-text-md); cursor: pointer; }
  .seg button:hover { background: var(--ui-hover); }
  .seg button.on { background: var(--ui-accent-wash); color: var(--ui-accent); font-weight: 600; }
  .quote { display: flex; flex-direction: column; gap: 4px; }
  .quote p { margin: 0; }
  .cost { font-size: var(--ui-text-xl); font-weight: 600; letter-spacing: -0.02em; }

  .primary, .ghost { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 18px; font-size: var(--ui-text-md); font-weight: 600; border: 0; border-radius: 9999px; cursor: pointer; text-decoration: none; }
  .primary { background: var(--ui-accent-solid); color: var(--ui-accent-ink); }
  .ghost { background: var(--ui-surface); color: var(--ui-ink); }
  .ghost:hover { background: var(--ui-hover); }
  .primary:disabled, .ghost:disabled { opacity: 0.4; cursor: not-allowed; }
  .wide { width: 100%; }

  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
  .tile, .thumb { padding: 0; border: 0; background: #000; cursor: pointer; display: block; }
  .tile video, .thumb video { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; }
  .tile:hover video, .item:hover video { opacity: 0.85; }
  .item { color: inherit; text-decoration: none; min-height: 44px; }
  .item.current .thumb { outline: 2px solid var(--ui-accent); outline-offset: -2px; }
  .caption { display: flex; align-items: center; gap: 6px; padding-top: 6px; font-size: var(--ui-text-sm); color: var(--ui-ink-2); }

  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; }
    .panel { position: static; }
  }
</style>
