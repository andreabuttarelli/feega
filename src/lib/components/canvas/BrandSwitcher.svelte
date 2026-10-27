<script lang="ts">
  import BrandLogo from '$lib/components/BrandLogo.svelte';
  import Star from '@lucide/svelte/icons/star';
  import { BrandHealth, BrandSection, brandHealth, brandSections, type SwitcherBrand } from '$lib/canvas/brand-switcher';

  let {
    brands,
    pinned,
    projectBrandId,
    query = $bindable(''),
    newBrandHref,
    onpick,
    onpin
  }: {
    brands: SwitcherBrand[];
    pinned: string[];
    projectBrandId: string | null;
    query?: string;
    newBrandHref: string;
    onpick: (brandId: string) => void;
    onpin: (brandId: string) => void;
  } = $props();

  const SECTION_LABEL: Record<BrandSection, string> = {
    [BrandSection.Pinned]: 'Pinned',
    [BrandSection.Project]: 'This project',
    [BrandSection.All]: 'All brands'
  };

  const HEALTH_LABEL: Record<BrandHealth, (b: SwitcherBrand) => string> = {
    [BrandHealth.Reconnect]: (b) => `Reconnect ${b.accountsDown} account${b.accountsDown === 1 ? '' : 's'}`,
    [BrandHealth.Scheduled]: (b) => `${b.scheduled} scheduled`,
    [BrandHealth.Idle]: () => 'Nothing scheduled',
    [BrandHealth.Unconnected]: () => 'No accounts'
  };

  const sections = $derived(brandSections(brands, { query, pinned, projectBrandId }));
</script>

<div class="switcher">
  <input class="search" type="search" placeholder="Search brands…" aria-label="Search brands" bind:value={query} />

  {#if sections.length === 0}
    <p class="hint">{brands.length ? 'No brand matches.' : 'No brands yet.'}</p>
  {/if}

  {#each sections as section (section.key)}
    <h4 class="section">{SECTION_LABEL[section.key]}</h4>
    <ul class="list">
      {#each section.brands as brand (brand.id)}
        {@const health = brandHealth(brand)}
        {@const isPinned = pinned.includes(brand.id)}
        <li class="row" data-brand-id={brand.id}>
          <button type="button" class="pick" onclick={() => onpick(brand.id)}>
            <span class="logo"><BrandLogo name={brand.name} url={brand.logoUrl} /></span>
            <span class="text">
              <span class="name">{brand.name}</span>
              <span class="status" data-health={health}><span class="dot"></span>{HEALTH_LABEL[health](brand)}</span>
            </span>
          </button>
          <button type="button" class="pin" class:on={isPinned} aria-pressed={isPinned} aria-label={isPinned ? `Unpin ${brand.name}` : `Pin ${brand.name}`} onclick={() => onpin(brand.id)}>
            <Star size={14} />
          </button>
        </li>
      {/each}
    </ul>
  {/each}

  <a class="new-brand" href={newBrandHref}>+ New brand</a>
</div>

<style>
  .switcher {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .search {
    height: var(--ui-control-h);
    margin-bottom: 6px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: 13px;
  }
  .search:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  .section {
    margin: 10px 2px 4px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ui-text-tertiary);
  }

  .list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row {
    display: flex;
    align-items: center;
    border-radius: var(--ui-radius-sm);
  }
  .row:hover {
    background: var(--ui-wash);
  }

  .pick {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .pick:focus-visible,
  .pin:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  .logo {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: var(--ui-radius-sm);
    overflow: hidden;
  }

  .text {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 13px;
    font-weight: 600;
    color: var(--ui-text);
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    color: var(--ui-text-secondary);
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-text-tertiary);
  }
  .status[data-health='scheduled'] .dot {
    background: var(--ui-ok);
  }
  .status[data-health='reconnect'] .dot {
    background: var(--ui-warn);
  }

  .pin {
    flex: none;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    margin-right: 4px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-tertiary);
    cursor: pointer;
  }
  .pin.on {
    color: var(--ui-accent-text);
  }
  .pin.on :global(svg) {
    fill: currentColor;
  }

  .hint {
    padding: 16px 4px;
    text-align: center;
    font-size: 12.5px;
    color: var(--ui-text-secondary);
  }

  .new-brand {
    margin-top: 8px;
    padding: 6px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--ui-accent-text);
    text-decoration: none;
  }
  .new-brand:hover {
    text-decoration: underline;
  }
</style>
