<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { FIELD_INPUT, FOCUS_RING } from '$lib/components/ui/shell/styles';
  import { MediaAccept, MediaKind, accepts, kindOfFile, linkOf, PickFrom, type MediaPick } from '$lib/motion/media/pick';
  import type { LibraryMedia, MediaSource, MediaUploader } from './media-upload';

  let {
    value,
    assets,
    label,
    accept = MediaAccept.Image,
    uploader = null,
    onpick
  }: {
    value: MediaPick | null;
    assets: LibraryMedia[];
    label: string;
    accept?: MediaAccept;
    uploader?: MediaUploader | null;
    onpick: (pick: MediaPick | null) => void;
  } = $props();

  const TABS: { tab: PickFrom; label: string }[] = [
    { tab: PickFrom.Upload, label: 'Upload' },
    { tab: PickFrom.Link, label: 'Link' },
    { tab: PickFrom.Library, label: 'Library' }
  ];

  const NOUN: Record<MediaAccept, string> = { [MediaAccept.Image]: 'image', [MediaAccept.Video]: 'video', [MediaAccept.Any]: 'image or video' };
  const FILE_TYPES: Record<MediaAccept, string> = { [MediaAccept.Image]: 'image/*', [MediaAccept.Video]: 'video/*', [MediaAccept.Any]: 'image/*,video/*' };
  const FIRST_FRAME = '#t=0.1';
  const SECONDS_PER_MINUTE = 60;
  const BUTTON = cn('h-7 rounded-sm bg-ui-input px-2 text-ui-label text-ui-text hover:bg-ui-wash disabled:opacity-50', FOCUS_RING);

  let open = $state(false);
  let tab = $state(PickFrom.Upload);
  let query = $state('');
  let link = $state('');
  let checked = $state<{ url: string; kind: MediaKind } | null>(null);
  let progress = $state<number | null>(null);
  let error = $state('');
  let dragging = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);

  const library = $derived(assets.filter((a) => accepts(accept, a.kind as MediaKind) && a.label.toLowerCase().includes(query.trim().toLowerCase())));
  const current = $derived(value?.assetId ? assets.find((a) => a.id === value.assetId) : undefined);
  const shown = $derived(value ? { src: current?.previewUrl ?? value.url ?? '', kind: (current?.kind as MediaKind | undefined) ?? value.kind, name: current?.label ?? value.url ?? 'Picked media', seconds: current?.seconds ?? null } : null);

  const clock = (s: number) => `${Math.floor(s / SECONDS_PER_MINUTE)}:${String(Math.round(s % SECONDS_PER_MINUTE)).padStart(2, '0')}`;

  function choose(pick: MediaPick | null) {
    onpick(pick);
    open = false;
    error = '';
    checked = null;
    link = '';
  }

  const upload = (file: File) => send(file, kindOfFile(file.type));

  async function send(source: MediaSource, kind: MediaKind | null) {
    if (!kind || !accepts(accept, kind)) {
      error = `This slot takes an ${NOUN[accept]}.`;
      return;
    }
    if (!uploader) {
      error = 'Uploads are not available here.';
      return;
    }
    error = '';
    progress = 0;
    const outcome = await uploader(source, (fraction) => (progress = fraction));
    progress = null;
    if (!outcome.ok) {
      error = outcome.error;
      return;
    }
    choose({ kind: outcome.asset.kind, assetId: outcome.asset.id });
  }

  function picked(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (file) {
      void upload(file);
    }
  }

  function dropped(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      void upload(file);
    }
  }

  function check() {
    const verdict = linkOf(link);
    if (!verdict.ok) {
      error = verdict.error;
      checked = null;
      return;
    }
    if (!accepts(accept, verdict.kind)) {
      error = `This slot takes an ${NOUN[accept]}.`;
      return;
    }
    error = '';
    checked = { url: verdict.url, kind: verdict.kind };
  }

  function useLink() {
    if (checked) {
      void send(new URL(checked.url), checked.kind);
    }
  }

  function reopen() {
    open = !open;
    error = '';
  }
</script>

{#snippet thumb(src: string, kind: MediaKind)}
  {#if kind === MediaKind.Video}
    <video class="size-full object-cover" src={`${src}${FIRST_FRAME}`} muted playsinline preload="metadata"></video>
  {:else}
    <img class="size-full object-cover" {src} alt="" />
  {/if}
{/snippet}

<div
  class={cn('flex flex-col gap-1.5', dragging && 'rounded-sm outline-2 outline-ui-accent-solid outline-dashed')}
  role="group"
  aria-label={label}
  data-testid="media-picker"
  ondragover={(e) => {
    e.preventDefault();
    dragging = true;
  }}
  ondragleave={() => (dragging = false)}
  ondrop={dropped}
>
  {#if shown}
    <div class="flex items-center gap-2" data-testid="media-preview">
      <div class="relative size-12 shrink-0 overflow-hidden rounded-sm border border-ui-divider bg-ui-input">
        {@render thumb(shown.src, shown.kind)}
        {#if shown.kind === MediaKind.Video && shown.seconds}<span class="absolute right-0.5 bottom-0.5 rounded-xs bg-black/70 px-1 text-[10px] text-white tabular-nums" data-testid="media-duration">{clock(shown.seconds)}</span>{/if}
      </div>
      <span class="min-w-0 flex-1 truncate text-ui-label text-ui-text-2" title={shown.name}>{shown.name}</span>
      <button type="button" class={BUTTON} data-testid="media-replace" aria-expanded={open} onclick={reopen}>Replace</button>
      <button type="button" class={BUTTON} data-testid="media-remove" onclick={() => choose(null)}>Remove</button>
    </div>
  {:else}
    <button type="button" class={cn('flex h-12 w-full items-center justify-center rounded-sm border border-dashed border-ui-divider text-ui-label text-ui-text-3 hover:bg-ui-wash', FOCUS_RING)} data-testid="media-add" aria-expanded={open} onclick={reopen}>
      <span data-testid="media-empty">Add an {NOUN[accept]} — or drop a file here</span>
    </button>
  {/if}

  {#if progress !== null}
    <progress class="h-1 w-full" max="1" value={progress} data-testid="media-progress" aria-label="Uploading"></progress>
  {/if}

  {#if open}
    <div class="flex flex-col gap-1.5 rounded-sm border border-ui-divider p-1.5" data-testid="media-chooser">
      <div class="grid grid-cols-3 gap-0.5" role="tablist">
        {#each TABS as t (t.tab)}
          <button type="button" role="tab" aria-selected={tab === t.tab} class={cn('h-6 rounded-sm text-ui-label', tab === t.tab ? 'bg-ui-selected text-ui-text' : 'text-ui-text-2 hover:bg-ui-wash', FOCUS_RING)} data-testid={`media-tab-${t.tab}`} onclick={() => ((tab = t.tab), (error = ''))}>{t.label}</button>
        {/each}
      </div>

      {#if tab === PickFrom.Upload}
        <input bind:this={fileInput} class="hidden" type="file" accept={FILE_TYPES[accept]} data-testid="media-file" onchange={picked} />
        <button type="button" class={cn(BUTTON, 'h-16 border border-dashed border-ui-divider bg-transparent')} disabled={progress !== null} onclick={() => fileInput?.click()}>Choose a file, or drop it here</button>
      {:else if tab === PickFrom.Link}
        <div class="flex gap-1">
          <input class={cn(FIELD_INPUT, 'flex-1')} type="url" placeholder="https://…" aria-label="Link to an image or video" data-testid="media-link" bind:value={link} oninput={() => (checked = null)} onkeydown={(e) => e.key === 'Enter' && check()} />
          <button type="button" class={BUTTON} data-testid="media-link-check" onclick={check}>Preview</button>
        </div>
        {#if checked}
          <div class="aspect-video w-full overflow-hidden rounded-sm border border-ui-divider bg-ui-input" data-testid="media-link-preview">{@render thumb(checked.url, checked.kind)}</div>
          <button type="button" class={BUTTON} data-testid="media-link-use" disabled={progress !== null} onclick={useLink}>Use this {checked.kind}</button>
        {/if}
      {:else}
        <input class={FIELD_INPUT} type="search" placeholder="Search the project" aria-label="Search the project" data-testid="media-search" bind:value={query} />
        <div class="grid max-h-48 grid-cols-4 gap-1 overflow-y-auto">
          {#each library as asset (asset.id)}
            <button type="button" class={cn('aspect-square overflow-hidden rounded-xs border border-ui-divider p-0', value?.assetId === asset.id && 'ring-2 ring-ui-accent-solid', FOCUS_RING)} title={asset.label} data-testid="media-library-item" data-asset-id={asset.id} onclick={() => choose({ kind: asset.kind as MediaKind, assetId: asset.id })}>{@render thumb(asset.previewUrl, asset.kind as MediaKind)}</button>
          {:else}
            <span class="col-span-4 text-ui-caption text-ui-text-3">{query ? 'Nothing matches.' : `No ${NOUN[accept]}s in this project yet. Upload one.`}</span>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if error}<p class="text-ui-caption text-ui-danger" role="alert" data-testid="media-error">{error}</p>{/if}
</div>
