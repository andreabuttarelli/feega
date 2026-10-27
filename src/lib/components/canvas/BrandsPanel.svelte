<script lang="ts">
  import { page } from '$app/state';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import BrandLogo from '$lib/components/BrandLogo.svelte';
  import BrandSwitcher from './BrandSwitcher.svelte';
  import BrandKit from './BrandKit.svelte';
  import BrandLibrary from './BrandLibrary.svelte';
  import { SegmentedControl } from '$lib/components/ui/shell';
  import { LibraryTab, LIBRARY_TABS, type LibraryItem } from '$lib/canvas/brand-library';
  import { AssetSize, canvasAssetUrl } from '$lib/canvas/asset-url';
  import { togglePin, type SwitcherBrand } from '$lib/canvas/brand-switcher';
  import type { PanelBrandBase } from '$lib/canvas/brand-pieces';

  type PanelBrand = SwitcherBrand & PanelBrandBase & { shortDescription: string | null };

  let { projectId }: { projectId: string } = $props();

  let brands = $state<PanelBrand[]>([]);
  let projectBrandId = $state<string | null>(null);
  let loading = $state(true);
  let failed = $state(false);
  let reload = $state(0);
  let query = $state('');
  let pinned = $state<string[]>([]);
  let openId = $state<string | null>(null);

  let tab = $state<LibraryTab>(LibraryTab.Kit);
  let library = $state<Record<string, LibraryItem[] | 'loading' | 'failed'>>({});

  const TAB_LABEL: Record<LibraryTab, string> = {
    [LibraryTab.Kit]: 'Kit',
    [LibraryTab.Products]: 'Products',
    [LibraryTab.Posts]: 'Posts',
    [LibraryTab.Ads]: 'Ads'
  };

  const TAB_EMPTY: Record<LibraryTab, string> = {
    [LibraryTab.Kit]: 'No logos, palette, fonts or voice yet. Add them in the brand settings.',
    [LibraryTab.Products]: 'No products. Sync the store from the brand settings.',
    [LibraryTab.Posts]: 'No posts or social posts yet.',
    [LibraryTab.Ads]: 'No competitor ads tracked for this brand.'
  };

  const libraryKey = $derived(`${openId}:${tab}`);
  const canvasId = $derived(page.params.canvasId ?? null);

  function thumb(assetId: string): string | null {
    return canvasId ? canvasAssetUrl(projectId, canvasId, assetId, AssetSize.Thumb) : null;
  }

  async function loadLibrary(key: string, brandId: string, which: LibraryTab) {
    library[key] = 'loading';
    const res = await fetch(`/api/v1/projects/${projectId}/agent/brands/${brandId}/library?tab=${which}`).catch(() => null);
    library[key] = res?.ok ? ((await res.json()) as { items: LibraryItem[] }).items : 'failed';
  }

  $effect(() => {
    if (openId && !library[libraryKey]) {
      void loadLibrary(libraryKey, openId, tab);
    }
  });

  const open = $derived(brands.find((b) => b.id === openId) ?? null);
  const newBrandHref = $derived(`/p/${projectId}/brands/new?returnTo=${encodeURIComponent(page.url.pathname)}`);

  async function pin(brandId: string) {
    const before = pinned;
    const wasPinned = pinned.includes(brandId);
    pinned = togglePin(pinned, brandId);

    const res = await fetch(`/api/v1/projects/${projectId}/agent/brands/${brandId}/pin`, { method: wasPinned ? 'DELETE' : 'POST' }).catch(() => null);
    if (!res?.ok) {
      pinned = before;
    }
  }

  $effect(() => {
    const id = projectId;
    void reload;

    let live = true;
    loading = true;
    failed = false;

    fetch(`/api/v1/projects/${id}/agent/brands`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { brands: PanelBrand[]; projectBrandId: string | null; pinned: string[] }) => {
        if (!live) {
          return;
        }
        brands = body.brands;
        projectBrandId = body.projectBrandId;
        pinned = body.pinned;
        openId ??= body.projectBrandId;
      })
      .catch(() => {
        if (live) {
          failed = true;
        }
      })
      .finally(() => {
        if (live) {
          loading = false;
        }
      });

    return () => {
      live = false;
    };
  });
</script>

<div class="brands-panel" data-testid="brands-panel">
  {#if loading}
    <p class="hint">Loading…</p>
  {:else if failed}
    <div class="state">
      <p class="hint">Can't read the brands.</p>
      <button type="button" class="retry" onclick={() => (reload += 1)}>Retry</button>
    </div>
  {:else if open}
    <div class="brand-head">
      <button type="button" class="back" aria-label="All brands" onclick={() => (openId = null)}><ChevronLeft size={16} /></button>
      <span class="logo"><BrandLogo name={open.name} url={open.logoUrl} /></span>
      <span class="name">{open.name}</span>
    </div>
    <SegmentedControl label="Brand material" value={tab} onchange={(value) => (tab = value as LibraryTab)} options={LIBRARY_TABS.map((value) => ({ value, label: TAB_LABEL[value] }))} />
    <div class="tab-body">
      {#if library[libraryKey] === 'failed'}
        <button type="button" class="retry" onclick={() => openId && loadLibrary(libraryKey, openId, tab)}>Retry</button>
      {:else if Array.isArray(library[libraryKey])}
        <BrandLibrary items={library[libraryKey] as LibraryItem[]} {thumb} empty={TAB_EMPTY[tab]} />
        {#if tab === LibraryTab.Kit}
          {#key open.id}
            <BrandKit {projectId} brand={open} />
          {/key}
        {/if}
      {:else}
        <p class="hint">Loading…</p>
      {/if}
    </div>
  {:else}
    <BrandSwitcher {brands} {pinned} {projectBrandId} bind:query {newBrandHref} onpick={(id) => (openId = id)} onpin={pin} />
  {/if}
</div>

<style>
  .brands-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .brand-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 2px 8px;
  }
  .back {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-icon-ink);
    cursor: pointer;
  }
  .back:hover {
    background: var(--ui-wash);
  }
  .logo {
    width: 28px;
    height: 28px;
    border-radius: var(--ui-radius-sm);
    overflow: hidden;
  }
  .name {
    font-size: 14px;
    font-weight: 600;
    color: var(--ui-text);
  }

  .tab-body {
    padding-top: 8px;
  }

  .hint {
    padding: 16px 4px;
    text-align: center;
    font-size: 12.5px;
    color: var(--ui-text-secondary);
  }
  .state {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .retry {
    border: 0;
    background: transparent;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    color: var(--ui-accent-text);
    cursor: pointer;
  }
</style>
