<script lang="ts">
  import ImagePlus from '@lucide/svelte/icons/image-plus';
  import X from '@lucide/svelte/icons/x';
  import { removeReference, sameReference, toggleReference, type NodeReference, type ReferenceSource } from '$lib/canvas/node-references';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import { Segmented } from '$lib/components/ui/control/index.js';

  type Choice = { ref: NodeReference; url: string | null; name: string };

  let {
    references,
    catalogue,
    media,
    assetUrl,
    onchange
  }: {
    references: NodeReference[];
    catalogue: { id: string; name: string; url: string | null }[];
    media: { id: string }[];
    assetUrl: (id: string) => string;
    onchange: (next: NodeReference[]) => void;
  } = $props();

  const TABS: { value: ReferenceSource; label: string; empty: string }[] = [
    { value: 'catalogue', label: 'Global', empty: 'The global catalogue is empty.' },
    { value: 'asset', label: 'Media', empty: 'No images in this project yet.' }
  ];

  let open = $state(false);
  let tab = $state<ReferenceSource>('catalogue');

  const choices = $derived<Record<ReferenceSource, Choice[]>>({
    catalogue: catalogue.map((image) => ({ ref: { source: 'catalogue', id: image.id }, url: image.url, name: image.name })),
    asset: media.map((asset) => ({ ref: { source: 'asset', id: asset.id }, url: assetUrl(asset.id), name: 'Media' }))
  });
  const current = $derived(TABS.find((t) => t.value === tab) ?? TABS[0]);

  function thumbOf(ref: NodeReference): string | null {
    return choices[ref.source].find((c) => sameReference(c.ref, ref))?.url ?? null;
  }

  function isPicked(ref: NodeReference): boolean {
    return references.some((r) => sameReference(r, ref));
  }
</script>

<div class="refs nodrag" data-testid="node-references">
  {#each references as ref (`${ref.source}:${ref.id}`)}
    {@const url = thumbOf(ref)}
    <span class="ref">
      {#if url}<img src={url} alt="" loading="lazy" decoding="async" width="32" height="32" />{/if}
      <button type="button" class="ref-remove" aria-label="Remove reference" onclick={() => onchange(removeReference(references, ref))}>
        <X size={12} strokeWidth={2} />
      </button>
    </span>
  {/each}
  <button type="button" class="refs-add" data-control="references" title="Add references" aria-label="Add references" onclick={() => (open = true)}>
    <ImagePlus size={14} strokeWidth={1.7} />
    <span class="refs-label">{references.length ? `References · ${references.length}` : 'Add references'}</span>
  </button>
</div>

<Dialog.Root bind:open>
  <Dialog.Content class="flex max-h-[80vh] w-[min(640px,calc(100vw-2rem))] max-w-none flex-col gap-0 p-0 sm:max-w-none" showCloseButton={false}>
    <header class="flex items-center gap-3 border-b border-line-2 p-3">
      <Dialog.Title class="text-sm font-semibold">References</Dialog.Title>
      <div class="w-48">
        <Segmented label="Source" value={tab} options={TABS} onchange={(v) => (tab = v as ReferenceSource)} />
      </div>
      <Button size="sm" class="ml-auto" data-control="references-done" onclick={() => (open = false)}>Done</Button>
    </header>

    {#if !choices[tab].length}
      <p class="m-0 p-6 text-center text-sm text-muted-foreground">{current.empty}</p>
    {:else}
      <div class="picker-grid">
        {#each choices[tab] as choice (choice.ref.id)}
          <button
            type="button"
            class="picker-item"
            class:picked={isPicked(choice.ref)}
            aria-pressed={isPicked(choice.ref)}
            title={choice.name}
            onclick={() => onchange(toggleReference(references, choice.ref))}
          >
            {#if choice.url}<img src={choice.url} alt={choice.name} loading="lazy" decoding="async" width="96" height="96" />{/if}
          </button>
        {/each}
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<style>
  .refs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px 0; }
  .refs-add {
    display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px;
    font: inherit; font-size: 12px; font-weight: 500; line-height: 1;
    color: var(--ink, #1d1d1f); background: var(--paper-2, #f9f9f9);
    border: 1px solid var(--line-2, #d2d2d7); border-radius: var(--ui-radius-md, 6px); cursor: pointer;
    transition: background var(--ui-dur-fast, 120ms) ease, border-color var(--ui-dur-fast, 120ms) ease;
  }
  .refs-add :global(svg) { color: var(--ink-soft, #6e6e73); }
  .refs-add:hover { background: var(--paper, #fff); border-color: var(--ink-soft, #6e6e73); }
  .refs-add:focus-visible { outline: none; box-shadow: var(--ui-focus); }
  .ref {
    position: relative; width: 32px; height: 32px; border-radius: var(--ui-radius-md, 6px);
    background: var(--paper-2, #f5f5f5); box-shadow: inset 0 0 0 1px var(--line, #e5e5e5);
  }
  .ref img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: inherit; }
  .ref-remove {
    position: absolute; top: -6px; right: -6px; display: grid; place-items: center; width: 18px; height: 18px; padding: 0;
    color: var(--ink, #1d1d1f); border: 0; border-radius: var(--ui-radius-full, 9999px);
    background: var(--ui-raised, #fff); box-shadow: var(--ui-shadow-float); cursor: pointer;
    opacity: 0; transition: opacity var(--ui-dur-fast, 120ms) ease;
  }
  .ref:hover .ref-remove, .ref-remove:focus-visible { opacity: 1; }

  .picker-grid { overflow: auto; padding: 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
  .picker-item {
    aspect-ratio: 1; padding: 0; overflow: hidden; border: 2px solid transparent; border-radius: var(--ui-radius-md, 6px);
    background: var(--paper-2, #f5f5f5); cursor: pointer;
  }
  .picker-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .picker-item.picked { border-color: var(--ui-accent, #0099ff); }
</style>
