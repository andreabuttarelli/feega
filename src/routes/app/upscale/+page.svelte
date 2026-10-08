<script lang="ts">
  import PageTitle from '$lib/components/PageTitle.svelte';
  import { onDestroy } from 'svelte';
  import { deserialize } from '$app/forms';
  import { goto, invalidateAll } from '$app/navigation';
  import PageHead from '$lib/components/PageHead.svelte';
  import BeforeAfter from '$lib/components/upscale/BeforeAfter.svelte';
  import { createSupabaseBrowserClient } from '$lib/supabase/client';
  import { canvasUploadPrefix } from '$lib/canvas/upload-kind';
  import { planUpscale, quoteUpscale, UPSCALE_MODES, UPSCALE_REFUSAL_TEXT, UPSCALE_TARGETS, UpscaleMode, UpscaleTarget } from '$lib/upscale';

  type Probe = { width: number; height: number; seconds: number; bytes: number; mimeType: string };
  type Picked = { kind: 'upload'; file: File; previewUrl: string } | { kind: 'asset'; id: string; previewUrl: string };

  const POLL_MS = 5000;
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

  const plan = $derived(probe ? planUpscale(probe, target, data.limits) : null);
  const quote = $derived(plan?.ok && probe ? quoteUpscale(plan, probe.seconds, data.pricing, mode) : null);
  const refusal = $derived(plan && !plan.ok ? UPSCALE_REFUSAL_TEXT[plan.error] : null);
  const job = $derived(data.job);

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
    if (!file) {
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
    try {
      const sourceFields = picked.kind === 'upload' ? await uploadFields(picked.file) : { source: 'asset', asset_id: picked.id };
      if (!sourceFields) {
        return;
      }

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
    }
  }
</script>

<div class="upscale">
  <PageHead title="AI Video Upscaler" subtitle="Upscale a clip to 2× or 4K with FLUX Video Upscale. MP4 up to 20 s, 1440p and 50 MB." />
  <PageTitle text="AI Video Upscaler" />

  {#if job}
    <section class="result" data-testid="upscale-job" data-status={job.status}>
      {#if job.status === 'running'}
        <p class="muted">Upscaling{job.factor ? ` ${job.factor}×` : ''}… this takes a few minutes. You can leave the page: the result lands on the <a href={job.canvasHref}>Upscale canvas</a>.</p>
      {:else if job.status === 'failed'}
        <p class="error">The upscale failed: {job.error ?? 'no result'}.</p>
      {:else if job.beforeUrl && job.afterUrl}
        <BeforeAfter before={job.beforeUrl} after={job.afterUrl} />
        <div class="actions">
          <a class="primary" href={job.afterUrl} download>Download</a>
          <a href={job.canvasHref}>Open on the canvas</a>
          <span class="muted">Saved to this project's assets, marked as AI-generated.</span>
        </div>
      {/if}
    </section>
  {:else}
    <section>
      <h3>Example <span class="muted">real FLUX Video Upscale output, 854×480 → 1708×960 · Big Buck Bunny © Blender Foundation, CC BY 3.0</span></h3>
      <BeforeAfter before={SAMPLE.before} after={SAMPLE.after} poster={SAMPLE.poster} label="Example: a 480p clip and its 2× upscale" />
    </section>
  {/if}

  <section>
    <h3>1 · Clip</h3>
    <div class="actions">
      <button type="button" onclick={() => fileInput?.click()} disabled={busy}>Upload MP4</button>
      <input bind:this={fileInput} type="file" accept="video/mp4" hidden onchange={pickFile} />
      {#if picked}<span class="muted">{probe ? `${probe.width}×${probe.height} · ${probe.seconds.toFixed(1)} s` : 'Reading…'}</span>{/if}
    </div>
    {#if data.library.length}
      <p class="muted">Or pick a video from this project:</p>
      <div class="tiles">
        {#each data.library as asset (asset.id)}
          <button type="button" class="tile" class:on={picked?.kind === 'asset' && picked.id === asset.id} onclick={() => pickAsset(asset)}>
            {#if asset.url}<video src={asset.url} muted preload="metadata"></video>{/if}
          </button>
        {/each}
      </div>
    {/if}
  </section>

  <section>
    <h3>2 · Size and mode</h3>
    <div class="chips">
      {#each UPSCALE_TARGETS as t (t.id)}
        <button type="button" class="chip" class:on={target === t.id} onclick={() => (target = t.id)}>{t.label}</button>
      {/each}
    </div>
    <div class="chips">
      {#each UPSCALE_MODES as m (m.id)}
        <button type="button" class="chip" class:on={mode === m.id} title={m.hint} onclick={() => (mode = m.id)}>{m.label}</button>
      {/each}
    </div>
    <p class="muted">{UPSCALE_MODES.find((m) => m.id === mode)?.hint}</p>
  </section>

  <section class="quote" data-testid="upscale-quote">
    {#if refusal}
      <p class="error">{refusal}</p>
    {:else if plan?.ok && probe}
      <p>{probe.width}×{probe.height} → <strong>{plan.width}×{plan.height}</strong> ({plan.factor}×)</p>
      <p>{quote?.credits != null ? `${quote.credits} credits` : 'Price shown after the run'} <span class="muted">· balance {data.balance}</span></p>
    {:else}
      <p class="muted">Pick a clip to see the output size and the price.</p>
    {/if}
  </section>

  {#if failure}<p class="error">{failure}</p>{/if}

  <div class="actions">
    <button type="button" class="primary" disabled={busy || !plan?.ok} onclick={start}>{busy ? 'Starting…' : 'Upscale'}</button>
  </div>
</div>

<style>
  .upscale { max-width: var(--content-max, 1100px); margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
  h3 { font-size: 13px; font-weight: 600; margin: 0 0 8px; }
  .muted { color: var(--ink-3, #6e6e73); font-size: 12px; font-weight: 400; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin-top: 6px; }
  .tile { padding: 0; border: 1px solid var(--ui-line-strong); background: #000; cursor: pointer; }
  .tile video { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; }
  .on { outline: 2px solid var(--ui-ink); outline-offset: -2px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
  .chip { padding: 6px 10px; font-size: 12.5px; border: 1px solid var(--ui-line-strong); background: var(--ui-bg); cursor: pointer; }
  .chip:hover { border-color: var(--ui-ink-3); }
  .chip.on { background: var(--ui-accent-wash); color: var(--ui-accent); border-color: var(--ui-accent); }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 8px; }
  .actions button, .actions a { padding: 8px 14px; font-size: 12.5px; font-weight: 600; border: 1px solid var(--ui-line-strong); background: var(--ui-bg); color: inherit; cursor: pointer; text-decoration: none; }
  .actions .primary { background: var(--ui-accent); color: var(--ui-accent-ink); border-color: var(--ui-accent); }
  .actions button:disabled { opacity: 0.5; cursor: not-allowed; }
  .quote { border: 1px solid var(--ui-line-strong); padding: 12px; font-size: 13px; }
  .quote p { margin: 2px 0; }
  .error { color: var(--danger, #c0392b); font-size: 12.5px; }
</style>
