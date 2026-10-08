<script lang="ts">
  import { onDestroy } from 'svelte';
  import { deserialize } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import Play from '@lucide/svelte/icons/play';
  import Pause from '@lucide/svelte/icons/pause';
  import Upload from '@lucide/svelte/icons/upload';
  import Download from '@lucide/svelte/icons/download';
  import SquarePen from '@lucide/svelte/icons/square-pen';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import X from '@lucide/svelte/icons/x';
  import Film from '@lucide/svelte/icons/film';
  import PageHead from '$lib/components/PageHead.svelte';
  import PublishDialog from '$lib/components/gallery/PublishDialog.svelte';
  import RemixBanner from '$lib/components/gallery/RemixBanner.svelte';
  import { goto } from '$app/navigation';
  import { BRAND_PARAM } from '$lib/gallery/model';
  import MotionPreview from '$lib/components/motion/MotionPreview.svelte';
  import ExportDialog from '$lib/components/motion/ExportDialog.svelte';
  import StudioParamControl from '$lib/components/canvas/StudioParamControl.svelte';
  import { ColorField, ControlRow, ControlLayout, NumberField, OptionMenu, RatioChips, Switch } from '$lib/components/ui/control/index.js';
  import { createSupabaseBrowserClient } from '$lib/supabase/client';
  import { canvasUploadPrefix } from '$lib/canvas/upload-kind';
  import { LAYOUTS } from '$lib/canvas/composition/index';
  import { CAMERA_PRESETS, type CameraPresetId } from '$lib/canvas/composition/camera';
  import type { LayoutId } from '$lib/canvas/composition/types';
  import { controlFor, setLayoutParam } from '$lib/canvas/composition-editor';
  import { BRAND_COLORS, COMPOSITION_LAYOUTS, MAX_COMPOSITION_MEDIA, AssetKind } from '$lib/motion/components';
  import { FORMATS, MOTION_FORMATS, type MotionDoc, MotionFormat } from '$lib/motion/doc';
  import { resolveColor } from '$lib/motion/brand';
  import { composeHtml } from '$lib/motion/hyperframes/compose';
  import { MAX_COMPOSE_SECONDS, MIN_SECONDS, applyDraft, clampSeconds, draftFromDoc, newDraft, withCamera, withLayout, type ComposeDraft, type ComposeMedia } from '$lib/motion/composition-draft';

  const SAVE_DEBOUNCE_MS = 700;
  const SaveState = { Saved: 'Saved', Saving: 'Saving…', Pending: 'Unsaved', Conflict: 'Reloaded the latest version', Failed: 'Not saved' } as const;
  type SaveState = (typeof SaveState)[keyof typeof SaveState];
  const MEDIA_KINDS = new Set<string>([AssetKind.Image, AssetKind.Video]);
  const FALLBACK_LAYOUT: LayoutId = 'tilted-grid';

  let { data } = $props();

  const supabase = createSupabaseBrowserClient();
  let doc = $state.raw<MotionDoc>(data.head.doc);
  let version = $state(data.head.version);
  let draft = $state.raw<ComposeDraft | null>(data.draft);
  let saveState = $state<SaveState>(SaveState.Saved);
  let notice = $state('');
  let frame = $state(0);
  let playing = $state(true);
  let exporting = $state(false);
  let publishing = $state(false);
  let listed = $state(data.gallery.listed);
  let uploading = $state(0);
  let dragging = $state(false);
  let preview = $state<MotionPreview | null>(null);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const library = $derived(data.assets.filter((a) => MEDIA_KINDS.has(a.kind)));
  const assetUrls = $derived(Object.fromEntries(data.assets.filter((a) => a.url).map((a) => [a.id, a.url as string])));
  const html = $derived(composeHtml({ doc, tokens: data.tokens, assets: assetUrls }));
  const picked = $derived(new Map((draft?.media ?? []).map((m, i) => [m.assetId, i])));
  const fixedCamera = $derived(draft ? LAYOUTS[draft.layout].camera === 'fixed' : false);
  const seconds = $derived(doc.durationInFrames / doc.fps);

  onDestroy(() => {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
  });

  function change(next: ComposeDraft) {
    const verdict = applyDraft(doc, next);
    if (!verdict.ok) {
      notice = verdict.error;
      return;
    }
    notice = '';
    draft = next;
    doc = verdict.doc;
    saveState = SaveState.Pending;
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => void save(), SAVE_DEBOUNCE_MS);
  }

  async function post(url: string, form: FormData) {
    const res = await fetch(url, { method: 'POST', body: form, headers: { 'x-sveltekit-action': 'true' } });
    return deserialize(await res.text());
  }

  async function save() {
    saveState = SaveState.Saving;
    const form = new FormData();
    form.set('doc', JSON.stringify(doc));
    form.set('version', String(version));
    form.set('summary', 'Edited in Compositions');
    const result = await post(`${data.editorUrl}?/save`, form);

    if (result.type === 'success') {
      version = Number(result.data?.version ?? version);
      saveState = SaveState.Saved;
      return;
    }
    if (result.type === 'failure' && result.data?.error === 'conflict') {
      const head = result.data.head as { version: number; doc: MotionDoc };
      doc = head.doc;
      draft = draftFromDoc(head.doc);
      version = head.version;
      saveState = SaveState.Conflict;
      return;
    }
    saveState = SaveState.Failed;
  }

  function toggleMedia(asset: { id: string; kind: string }) {
    if (!draft) {
      return;
    }
    const without = draft.media.filter((m) => m.assetId !== asset.id);
    if (without.length !== draft.media.length) {
      change({ ...draft, media: without });
      return;
    }
    if (draft.media.length >= MAX_COMPOSITION_MEDIA) {
      notice = `A composition holds up to ${MAX_COMPOSITION_MEDIA} images and videos.`;
      return;
    }
    change({ ...draft, media: [...draft.media, { assetId: asset.id, kind: asset.kind as ComposeMedia['kind'] }] });
  }

  async function uploadOne(file: File): Promise<ComposeMedia | null> {
    const path = `${canvasUploadPrefix(data.orgId, data.projectId)}${crypto.randomUUID()}-${file.name}`;
    const up = await supabase.storage.from('canvas-assets').upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) {
      notice = up.error.message;
      return null;
    }
    const form = new FormData();
    form.set('path', path);
    form.set('file_name', file.name);
    form.set('mime_type', file.type);
    form.set('bytes', String(file.size));
    const result = await post(`/app/compose/${data.node.id}?project=${data.projectId}&/upload`, form);
    if (result.type !== 'success') {
      notice = result.type === 'failure' ? String(result.data?.error ?? 'Upload refused') : 'Upload failed';
      return null;
    }
    return { assetId: String(result.data?.assetId), kind: result.data?.kind as ComposeMedia['kind'] };
  }

  async function upload(files: FileList | File[]) {
    if (!draft || !files.length) {
      return;
    }
    uploading += files.length;
    try {
      const made = (await Promise.all([...files].map(uploadOne))).filter((m): m is ComposeMedia => m !== null);
      await invalidateAll();
      if (made.length && draft) {
        change({ ...draft, media: [...draft.media, ...made].slice(0, MAX_COMPOSITION_MEDIA) });
      }
    } finally {
      uploading -= files.length;
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    if (e.dataTransfer?.files) {
      void upload(e.dataTransfer.files);
    }
  }

  function exportFrames(...args: Parameters<MotionPreview['render']>) {
    if (!preview) {
      return Promise.reject(new Error('the preview is still loading'));
    }
    return preview.render(...args);
  }

  function optionsOf(table: Record<string, { label: string }>) {
    return Object.entries(table).map(([value, def]) => ({ value, label: def.label }));
  }
</script>

<svelte:head><title>{data.node.name ?? 'Composition'} · Compositions · feega</title></svelte:head>

<PageHead title={data.node.name ?? 'Composition'} subtitle="Compositions" />

{#if exporting}
  <ExportDialog
    {doc}
    {assetUrls}
    scope={{ orgId: data.orgId, projectId: data.projectId, nodeId: data.node.id }}
    editorUrl={data.editorUrl}
    fileName={data.node.name ?? 'composition'}
    render={exportFrames}
    tokens={data.tokens}
    server={{ ...data.serverRender, version, saved: saveState === SaveState.Saved, assetHref: (id: string) => `${data.canvasHref}/assets/${id}` }}
    onclose={() => (exporting = false)}
  />
{/if}

{#if publishing}
  <PublishDialog
    actionUrl={`/app/compose/${data.node.id}?project=${data.projectId}`}
    {doc}
    assets={assetUrls}
    tokens={data.tokens}
    name={data.node.name ?? ''}
    {listed}
    saved={saveState === SaveState.Saved}
    onlisted={(item) => (listed = item)}
    onclose={() => (publishing = false)}
  />
{/if}

<div class="compose" data-testid="compose-editor">
  {#if data.gallery.remixOf}
    <RemixBanner origin={data.gallery.remixOf} onbrand={() => goto(`${data.editorUrl}?${BRAND_PARAM}=1`)} />
  {/if}
  <header class="bar">
    <a class="back" href={`/app/compose?project=${data.projectId}`}>Compositions</a>
    <span class="save" data-testid="compose-save" data-state={saveState}>{saveState}</span>
    <div class="actions">
      <a class="button" href={data.canvasHref}><LayoutGrid size={14} /> Canvas</a>
      <a class="button" href={data.editorUrl} data-testid="compose-open-motion"><SquarePen size={14} /> Open in motion editor</a>
      <button type="button" class="button" onclick={() => (publishing = true)} data-testid="publish-open">{listed ? 'In gallery' : 'Publish'}</button>
      <button type="button" class="button primary" onclick={() => (exporting = true)} data-testid="compose-export"><Download size={14} /> Export</button>
    </div>
  </header>

  <div class="body">
    <section class="stage-col">
      <div class="preview">
        <MotionPreview bind:this={preview} {html} width={doc.width} height={doc.height} fps={doc.fps} bind:frame bind:playing />
      </div>
      <div class="transport">
        <button type="button" class="icon" aria-label={playing ? 'Pause' : 'Play'} onclick={() => (playing = !playing)}>
          {#if playing}<Pause size={14} />{:else}<Play size={14} />{/if}
        </button>
        <input type="range" min="0" max={doc.durationInFrames - 1} step="1" bind:value={frame} aria-label="Time" oninput={() => (playing = false)} />
        <span class="time">{(frame / doc.fps).toFixed(1)} / {seconds.toFixed(1)}s</span>
      </div>
      {#if notice}<p class="notice" role="alert">{notice}</p>{/if}
    </section>

    <aside class="panel">
      {#if !draft}
        <section class="group">
          <h3>No composition in this video</h3>
          <p class="muted">It was removed in the motion editor. Add one back to keep editing here.</p>
          <button type="button" class="button primary" onclick={() => change(newDraft(FALLBACK_LAYOUT))}>Add composition</button>
        </section>
      {:else}
        {@const current = draft}
        <section class="group" aria-labelledby="g-template">
          <h3 id="g-template">Template</h3>
          <div class="chips" role="radiogroup" aria-label="Template">
            {#each COMPOSITION_LAYOUTS as layout (layout)}
              <button type="button" role="radio" aria-checked={current.layout === layout} class:on={current.layout === layout} onclick={() => change(withLayout(current, layout))}>{LAYOUTS[layout].label}</button>
            {/each}
          </div>
        </section>

        <section class="group" aria-labelledby="g-media">
          <h3 id="g-media">Images and videos <span class="count">{current.media.length}/{MAX_COMPOSITION_MEDIA}</span></h3>
          <label class="drop" class:dragging ondragover={(e) => { e.preventDefault(); dragging = true; }} ondragleave={() => (dragging = false)} ondrop={onDrop}>
            <Upload size={16} />
            <span>{uploading ? `Uploading ${uploading}…` : 'Drop files or click to upload'}</span>
            <input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple onchange={(e) => { const files = e.currentTarget.files; if (files) { void upload([...files]); } e.currentTarget.value = ''; }} />
          </label>
          {#if library.length}
            <ul class="library" data-testid="compose-library">
              {#each library as asset (asset.id)}
                {@const at = picked.get(asset.id)}
                <li>
                  <button type="button" class="tile" class:on={at !== undefined} aria-pressed={at !== undefined} aria-label={asset.label} onclick={() => toggleMedia(asset)}>
                    {#if asset.kind === AssetKind.Image}
                      <img src={asset.previewUrl} alt="" loading="lazy" />
                    {:else if asset.url}
                      <video src={asset.url} muted playsinline preload="metadata"></video>
                      <span class="kind"><Film size={12} /></span>
                    {/if}
                    {#if at !== undefined}<span class="badge">{at + 1}</span>{/if}
                  </button>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="muted">No images or videos in this project yet. Upload some, or make them on a canvas or in the Photo studio.</p>
          {/if}
          {#if current.media.length}
            <button type="button" class="link" onclick={() => change({ ...current, media: [] })}><X size={12} /> Clear selection</button>
          {/if}
        </section>

        <section class="group" aria-labelledby="g-text">
          <h3 id="g-text">Text and colour</h3>
          <ControlRow label="Headline">
            <textarea rows="2" maxlength="500" placeholder="Optional headline" value={current.headline} onchange={(e) => change({ ...current, headline: e.currentTarget.value })}></textarea>
          </ControlRow>
          <ControlRow label="Headline colour">
            <div class="swatches">
              {#each BRAND_COLORS as token (token)}
                <button type="button" class="swatch" class:on={current.headlineColor === token} title={token} aria-label={token} style={`background: ${resolveColor(token, data.tokens)}`} onclick={() => change({ ...current, headlineColor: token })}></button>
              {/each}
            </div>
          </ControlRow>
          <ControlRow label="Background" layout={ControlLayout.Inline}>
            <ColorField label="Background" value={current.background} onchange={(v) => change({ ...current, background: String(v) })} />
          </ControlRow>
          <ControlRow label={`Logo${data.tokens.logoUrl ? '' : ' (no brand logo)'}`} layout={ControlLayout.Inline}>
            <Switch label="Logo" value={current.logo} disabled={!data.tokens.logoUrl} onchange={(v) => change({ ...current, logo: v === true })} />
          </ControlRow>
        </section>

        <section class="group" aria-labelledby="g-timing">
          <h3 id="g-timing">Timing and format</h3>
          <ControlRow label="Format">
            <RatioChips label="Format" value={current.format} options={MOTION_FORMATS.map((f) => ({ value: f, label: FORMATS[f].label }))} onchange={(v) => change({ ...current, format: v as MotionFormat })} />
          </ControlRow>
          <ControlRow label="Loop length (s)" layout={ControlLayout.Inline}>
            <NumberField label="Loop length (s)" value={current.seconds} min={MIN_SECONDS} max={MAX_COMPOSE_SECONDS} step={0.5} onchange={(v) => change({ ...current, seconds: clampSeconds(Number(v)) })} />
          </ControlRow>
        </section>

        <section class="group" aria-labelledby="g-layout">
          <h3 id="g-layout">{LAYOUTS[current.layout].label} settings</h3>
          <div class="params">
            {#each LAYOUTS[current.layout].params as param (param.name)}
              <StudioParamControl label={param.label} control={controlFor(param, current.layoutParams[param.name])} onchange={(value) => change({ ...current, layoutParams: setLayoutParam(current.layoutParams, param.name, value) })} />
            {/each}
          </div>
        </section>

        <section class="group" aria-labelledby="g-camera">
          <h3 id="g-camera">Camera</h3>
          <ControlRow label="Move">
            <OptionMenu label="Camera" value={current.camera} options={optionsOf(CAMERA_PRESETS)} disabled={fixedCamera} onchange={(v) => change(withCamera(current, v as CameraPresetId))} />
          </ControlRow>
          {#if fixedCamera}<p class="muted">This template holds the camera still.</p>{/if}
          <div class="params">
            {#each CAMERA_PRESETS[current.camera].params as param (param.name)}
              <StudioParamControl label={param.label} control={controlFor(param, current.cameraParams[param.name])} onchange={(value) => change({ ...current, cameraParams: setLayoutParam(current.cameraParams, param.name, value) })} />
            {/each}
          </div>
        </section>
      {/if}
    </aside>
  </div>
</div>

<style>
  .compose {
    max-width: 1280px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border: 1px solid var(--line);
    background: var(--paper);
  }

  .back {
    font-size: 12.5px;
    color: var(--ink-soft);
    text-decoration: none;
  }

  .back:hover {
    color: var(--ink);
  }

  .save {
    font-size: 12px;
    color: var(--ink-faint);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-left: auto;
  }

  .button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    border: 1px solid var(--line-2);
    background: var(--paper);
    color: var(--ink);
    font-size: 13px;
    text-decoration: none;
    cursor: pointer;
  }

  .button:hover {
    border-color: var(--ink);
  }

  .button.primary {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--paper);
    font-weight: 600;
  }

  .body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 380px;
    gap: 12px;
    align-items: start;
  }

  .stage-col {
    position: sticky;
    top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border: 1px solid var(--line);
    background: var(--paper-3);
  }

  .preview {
    container-type: size;
    height: min(72vh, 820px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .transport {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .transport input {
    flex: 1;
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--line-2);
    background: var(--paper);
    color: var(--ink);
    cursor: pointer;
  }

  .time {
    font-size: 12px;
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
  }

  .notice {
    margin: 0;
    font-size: 12.5px;
    color: var(--color-destructive, #c0392b);
  }

  .panel {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--line);
    background: var(--paper);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
  }

  .group + .group {
    border-top: 1px solid var(--line);
  }

  h3 {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink);
  }

  .count {
    font-weight: 400;
    color: var(--ink-faint);
    text-transform: none;
    letter-spacing: 0;
  }

  .muted {
    margin: 0;
    font-size: 12px;
    color: var(--ink-soft);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chips button {
    height: 28px;
    padding: 0 10px;
    border: 1px solid var(--line-2);
    background: var(--paper);
    color: var(--ink-soft);
    font-size: 12px;
    cursor: pointer;
  }

  .chips button.on {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--paper);
  }

  .drop {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 56px;
    border: 1px dashed var(--line-2);
    color: var(--ink-soft);
    font-size: 12.5px;
    cursor: pointer;
  }

  .drop.dragging,
  .drop:hover {
    border-color: var(--ink);
    color: var(--ink);
  }

  .drop input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .library {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    max-height: 300px;
    overflow: auto;
  }

  .tile {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 1;
    padding: 0;
    border: 1px solid var(--line);
    background: var(--paper-3);
    overflow: hidden;
    cursor: pointer;
  }

  .tile img,
  .tile video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .tile.on {
    outline: 2px solid var(--ink);
    outline-offset: -2px;
  }

  .kind {
    position: absolute;
    left: 4px;
    bottom: 4px;
    display: inline-flex;
    padding: 2px;
    background: rgb(0 0 0 / 0.6);
    color: #fff;
  }

  .badge {
    position: absolute;
    top: 4px;
    right: 4px;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    background: var(--ink);
    color: var(--paper);
    font-size: 11px;
    line-height: 18px;
    text-align: center;
  }

  .link {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink-soft);
    font-size: 12px;
    cursor: pointer;
  }

  textarea {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid var(--line-2);
    background: var(--paper);
    color: var(--ink);
    font: inherit;
    font-size: 13px;
    resize: vertical;
  }

  .swatches {
    display: flex;
    gap: 6px;
  }

  .swatch {
    width: 24px;
    height: 24px;
    border: 1px solid var(--line-2);
    cursor: pointer;
  }

  .swatch.on {
    outline: 2px solid var(--ink);
    outline-offset: 1px;
  }

  .params {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 12px;
  }

  @media (max-width: 900px) {
    .body {
      grid-template-columns: 1fr;
    }

    .stage-col {
      position: static;
    }

    .preview {
      height: min(60vh, 560px);
    }
  }

  @media (max-width: 640px) {
    .actions {
      margin-left: 0;
      width: 100%;
    }

    .actions .button {
      flex: 1;
      justify-content: center;
      padding: 0 8px;
    }

    .library {
      grid-template-columns: repeat(3, 1fr);
    }

    .params {
      grid-template-columns: 1fr;
    }
  }
</style>
