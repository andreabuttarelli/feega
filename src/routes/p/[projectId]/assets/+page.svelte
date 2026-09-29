<script lang="ts">
  import PageHead from '$lib/components/PageHead.svelte';
  import { Upload, Images } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Notice } from '$lib/components/ui/notice';
  import { EmptyState } from '$lib/components/ui/empty-state';
  import { deserialize } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { createSupabaseBrowserClient } from '$lib/supabase/client';
  import { verdictForUpload, canvasUploadPrefix } from '$lib/canvas/upload-kind';
  import { assetDrag, CANVAS_DRAG_FILLED_NODE, serializeFilledNodeDrag } from '$lib/canvas/drag-payload';
  import { CANVAS_DRAG_MEDIUM } from '$lib/canvas/new-node';

  let { data } = $props();

  type Filter = 'all' | 'generated' | 'upload' | 'global';

  const EMPTY_HINT: Record<Filter, string> = {
    all: 'Generate or upload something and it lands here.',
    generated: 'Nothing generated yet. Run a node on the canvas to fill this in.',
    upload: 'Nothing uploaded yet. Upload a file, or drop one onto a canvas.',
    global: 'The shared reference catalogue is empty.'
  };

  const FILTERS: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'generated', label: 'Generated' },
    { value: 'upload', label: 'Uploaded' },
    { value: 'global', label: 'Global' }
  ];

  function filterHref(value: Filter): string {
    return value === 'all' ? `/p/${data.project.id}/assets` : `/p/${data.project.id}/assets?source=${value}`;
  }

  function formatBytes(n: number | null): string {
    if (n == null || !Number.isFinite(n)) return '';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * UN FILE VA DRITTO NELLO STORAGE DAL BROWSER, e solo il percorso arriva al server — lo stesso
   * schema di `[canvasId]/+page.svelte::upload`. Un documento arriva già convertito in markdown
   * quando la pagina ricarica: `registerUploadedAsset` lo fa lato server, questa pagina non
   * sa niente di conversione.
   */
  const supabase = createSupabaseBrowserClient();
  let uploading = $state(false);
  let uploadError = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);

  async function upload(file: File) {
    uploadError = null;
    const verdict = verdictForUpload(file.type, file.name, file.size);
    if (!verdict.ok) {
      uploadError = verdict.why;
      return;
    }

    uploading = true;
    try {
      const path = `${canvasUploadPrefix(data.orgId, data.project.id)}${crypto.randomUUID()}-${file.name}`;
      const up = await supabase.storage
        .from('canvas-assets')
        .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (up.error) {
        uploadError = up.error.message;
        return;
      }

      const body = new FormData();
      body.set('path', path);
      body.set('file_name', file.name);
      body.set('mime_type', file.type);
      body.set('bytes', String(file.size));

      const res = await fetch('?/upload', {
        method: 'POST',
        headers: { 'x-sveltekit-action': 'true' },
        body
      });
      const result = deserialize(await res.text());
      if (result.type !== 'success') {
        uploadError = 'Upload failed';
        return;
      }
      await invalidateAll();
    } finally {
      uploading = false;
    }
  }

  function onFilePicked(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void upload(file);
  }

  /** TRASCINARE UNA TILE VERSO LA TELA — `assetDrag` (`drag-payload.ts`) porta la tabella "cosa
   *  diventa", la stessa che la sidebar del progetto usa per le sue card. */
  function onTileDragStart(e: DragEvent, item: (typeof data.items)[number]) {
    const drag = assetDrag(item);
    if (!drag || !e.dataTransfer) return;

    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(CANVAS_DRAG_FILLED_NODE, serializeFilledNodeDrag(drag));
    e.dataTransfer.setData(CANVAS_DRAG_MEDIUM, drag.type);
  }
</script>

<div class="media-page">
  <PageHead title="Assets" subtitle="Every file this project has, generated or uploaded." />

  <nav class="filters" aria-label="Filter by source">
    {#each FILTERS as f (f.value)}
      <a class="filter" class:active={data.filter === f.value} href={filterHref(f.value)}>
        {f.label}
        {#if data.filter === f.value}
          <span class="count">{data.filter === 'global' ? data.catalogue.length : data.items.length}</span>
        {/if}
      </a>
    {/each}

    <input
      bind:this={fileInput}
      type="file"
      class="file-input"
      onchange={onFilePicked}
      accept="image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime,.pdf,.docx,.xlsx,.xls,.html,.htm,.csv,.txt,.md,.markdown,.xml,.rss,.atom,.ipynb"
    />
    <Button variant="secondary" size="sm" class="upload-btn" disabled={uploading} onclick={() => fileInput?.click()}>
      <Upload />
      {uploading ? 'Uploading…' : 'Upload'}
    </Button>
  </nav>

  {#if uploadError}
    <Notice tone="error">{uploadError}</Notice>
  {/if}

  {#if data.filter === 'global'}
    {#if !data.catalogue.length}
      <EmptyState title="Nothing here yet" description={EMPTY_HINT.global}>
        {#snippet icon()}<Images />{/snippet}
      </EmptyState>
    {:else}
      <div class="asset-grid">
        {#each data.catalogue as image (image.id)}
          <div class="tile">
            <Badge variant="outline" class="tile-badge">global</Badge>
            {#if image.url}
              <img src={image.url} alt={image.name} loading="lazy" decoding="async" width="180" height="140" />
            {:else}
              <span class="ph">image</span>
            {/if}
            <div class="meta"><span class="dim">{image.name}</span></div>
          </div>
        {/each}
      </div>
    {/if}
  {:else if !data.items.length}
    <EmptyState title="Nothing here yet" description={EMPTY_HINT[data.filter as Filter]}>
      {#snippet icon()}<Images />{/snippet}
    </EmptyState>
  {:else}
    <div class="asset-grid">
      {#each data.items as item (item.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -- trascinare una tile è una
             scorciatoia sulla libreria, non l'unico modo di portare l'asset sulla tela: chi usa
             la tastiera può ancora aprire il nodo dal link "from …" qui sotto. -->
        <div
          class="tile"
          draggable={Boolean(assetDrag(item))}
          ondragstart={(e) => onTileDragStart(e, item)}
        >
          <Badge variant="outline" class="tile-badge">
            {item.source === 'generated' ? 'Generated' : 'Uploaded'}
          </Badge>

          {#if item.type === 'image' && item.signedUrl}
            <img src={item.signedUrl} alt="" loading="lazy" decoding="async" width="180" height="140" />
          {:else if item.type === 'video' && item.signedUrl}
            <video src={item.signedUrl} muted playsinline preload="metadata"></video>
          {:else if item.type === 'text'}
            <p class="text-preview">{item.content}</p>
          {:else if item.type === 'document'}
            <p class="text-preview">{(item.content ?? '').slice(0, 400)}</p>
          {:else}
            <span class="ph">{item.type}</span>
          {/if}

          <div class="meta">
            <span class="dim">
              {[item.width && item.height ? `${item.width}×${item.height}` : '', formatBytes(item.bytes)].filter(Boolean).join(' · ')}
            </span>
            {#if item.sourceNode}
              <a class="node-link" href={`/p/${data.project.id}/c/${item.sourceNode.canvasId}`}>
                from {item.sourceNode.displayName || 'node'}
              </a>
            {:else if item.sourceNodeId}
              <span class="node-gone">node deleted</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .media-page { max-width: var(--content-max, 1100px); margin: 0 auto; padding: 0; }

  .filters { display: flex; align-items: center; gap: 6px; margin: 8px 0 18px; }
  .filter {
    font-size: 13px; font-weight: 600; padding: 7px 14px;
    color: var(--ink-soft); text-decoration: none; border: 1px solid transparent;
  }
  .filter:hover { color: var(--ink); }
  .filter.active { background: var(--paper-2); color: var(--ink); border-color: var(--line); }
  .count { margin-left: 6px; font-size: 12px; font-weight: 500; color: var(--ink-faint); font-variant-numeric: tabular-nums; }

  .file-input { display: none; }
  .filters :global(.upload-btn) { margin-left: auto; }

  .asset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }

  :global([data-viewport='mobile']) .media-page { padding: 8px var(--page-gutter) 24px; }
  :global([data-viewport='mobile']) .filters { flex-wrap: wrap; gap: 4px; }
  :global([data-viewport='mobile']) .filter { min-height: var(--touch-target); display: inline-flex; align-items: center; padding: 0 12px; }
  :global([data-viewport='mobile']) .filters :global(.upload-btn) { min-height: var(--touch-target); order: 1; width: 100%; margin: 4px 0 0; }
  :global([data-viewport='mobile']) .asset-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .tile {
    position: relative; overflow: hidden; background: var(--paper-2);
    border: 1px solid var(--line); display: flex; flex-direction: column; min-height: 160px;
  }
  .tile[draggable='true'] { cursor: grab; }
  .tile img, .tile video { width: 100%; height: 140px; object-fit: cover; display: block; }
  .text-preview {
    margin: 0; padding: 36px 12px 12px; font-size: 12px; line-height: 1.4; color: var(--ink);
    height: 140px; overflow: hidden;
  }
  .ph {
    height: 140px; display: grid; place-items: center; font-size: 12px; color: var(--ink-faint);
    text-transform: uppercase; letter-spacing: 0.06em;
  }

  .tile :global(.tile-badge) {
    position: absolute; top: 8px; left: 8px; z-index: 1;
    background: color-mix(in srgb, var(--paper) 90%, transparent); color: var(--ink-soft);
  }

  .meta { padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; }
  .dim { font-size: 11px; color: var(--ink-faint); }
  .node-link { font-size: 11px; color: var(--accent, #6d4aff); text-decoration: none; }
  .node-link:hover { text-decoration: underline; }
  .node-gone { font-size: 11px; color: var(--ink-faint); font-style: italic; }
</style>
