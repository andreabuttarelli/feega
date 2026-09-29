<script lang="ts">
  import { removeReference, sameReference, toggleReference, type NodeReference, type ReferenceSource } from '$lib/canvas/node-references';

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

  const TABS: { value: ReferenceSource; label: string }[] = [
    { value: 'catalogue', label: 'Global' },
    { value: 'asset', label: 'Media' }
  ];

  let open = $state(false);
  let tab = $state<ReferenceSource>('catalogue');

  const choices = $derived<Record<ReferenceSource, Choice[]>>({
    catalogue: catalogue.map((image) => ({ ref: { source: 'catalogue', id: image.id }, url: image.url, name: image.name })),
    asset: media.map((asset) => ({ ref: { source: 'asset', id: asset.id }, url: assetUrl(asset.id), name: 'Media' }))
  });

  function thumbOf(ref: NodeReference): string | null {
    return choices[ref.source].find((c) => sameReference(c.ref, ref))?.url ?? null;
  }

  function toBody(el: HTMLElement) {
    document.body.appendChild(el);
    return { destroy: () => el.remove() };
  }

  function isPicked(ref: NodeReference): boolean {
    return references.some((r) => sameReference(r, ref));
  }
</script>

<div class="refs nodrag" data-testid="node-references">
  {#each references as ref (`${ref.source}:${ref.id}`)}
    {@const url = thumbOf(ref)}
    <span class="ref">
      {#if url}<img src={url} alt="" loading="lazy" decoding="async" width="28" height="28" />{/if}
      <button type="button" class="ref-remove" aria-label="Remove reference" onclick={() => onchange(removeReference(references, ref))}>×</button>
    </span>
  {/each}
  <button type="button" class="refs-add" onclick={() => (open = true)}>
    {references.length ? `References (${references.length})` : '+ References'}
  </button>
</div>

{#if open}
  <div class="picker-backdrop" use:toBody role="presentation" onclick={() => (open = false)}>
    <div class="picker" role="dialog" aria-label="References" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && (open = false)}>
      <header class="picker-head">
        <nav class="picker-tabs">
          {#each TABS as t (t.value)}
            <button type="button" class:active={tab === t.value} onclick={() => (tab = t.value)}>{t.label}</button>
          {/each}
        </nav>
        <button type="button" class="picker-done" onclick={() => (open = false)}>Done</button>
      </header>

      {#if !choices[tab].length}
        <p class="picker-empty">{tab === 'catalogue' ? 'The global catalogue is empty.' : 'No images in this project yet.'}</p>
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
    </div>
  </div>
{/if}

<style>
  .refs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 4px 6px; border-top: 1px solid var(--line, #e5e5e5); }
  .ref { position: relative; width: 28px; height: 28px; background: var(--paper-2, #f5f5f5); border: 1px solid var(--line, #e5e5e5); }
  .ref img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .ref-remove {
    position: absolute; top: -6px; right: -6px; width: 14px; height: 14px; padding: 0; line-height: 12px;
    font-size: 11px; border: 1px solid var(--line, #e5e5e5); background: var(--paper, #fff); cursor: pointer;
  }
  .refs-add { font-size: 11px; padding: 4px 8px; border: 1px solid var(--line, #e5e5e5); background: var(--paper, #fff); cursor: pointer; }

  .picker-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgb(0 0 0 / 0.35); display: grid; place-items: center; }
  .picker {
    width: min(640px, calc(100vw - 32px)); max-height: 80vh; display: flex; flex-direction: column;
    background: var(--paper, #fff); border: 1px solid var(--line, #e5e5e5);
  }
  .picker-head { display: flex; align-items: center; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--line, #e5e5e5); }
  .picker-tabs { display: flex; gap: 4px; }
  .picker-tabs button, .picker-done { font-size: 13px; font-weight: 600; padding: 6px 12px; border: 1px solid transparent; background: none; cursor: pointer; }
  .picker-tabs button.active { background: var(--paper-2, #f5f5f5); border-color: var(--line, #e5e5e5); }
  .picker-done { border-color: var(--line, #e5e5e5); }
  .picker-empty { padding: 24px; margin: 0; font-size: 13px; color: var(--ink-soft, #6e6e73); text-align: center; }
  .picker-grid { overflow: auto; padding: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
  .picker-item { aspect-ratio: 1; padding: 0; border: 2px solid transparent; background: var(--paper-2, #f5f5f5); cursor: pointer; }
  .picker-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .picker-item.picked { border-color: var(--accent, #6d4aff); }
</style>
