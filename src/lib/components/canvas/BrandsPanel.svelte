<script lang="ts">
  import { page } from '$app/state';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import BrandLogo from '$lib/components/BrandLogo.svelte';
  import BrandSwitcher from './BrandSwitcher.svelte';
  import BrandKit from './BrandKit.svelte';
  import { togglePin, type SwitcherBrand } from '$lib/canvas/brand-switcher';
  import type { PanelBrandBase } from '$lib/canvas/brand-pieces';

  type PanelBrand = SwitcherBrand & PanelBrandBase & { shortDescription: string | null };

  const PINS_KEY = 'feega:brand-pins';

  let { projectId }: { projectId: string } = $props();

  let brands = $state<PanelBrand[]>([]);
  let projectBrandId = $state<string | null>(null);
  let loading = $state(true);
  let failed = $state(false);
  let reload = $state(0);
  let query = $state('');
  let pinned = $state<string[]>(readPins());
  let openId = $state<string | null>(null);

  const open = $derived(brands.find((b) => b.id === openId) ?? null);
  const newBrandHref = $derived(`/p/${projectId}/brands/new?returnTo=${encodeURIComponent(page.url.pathname)}`);

  function readPins(): string[] {
    try {
      return JSON.parse(localStorage.getItem(PINS_KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  function pin(brandId: string) {
    pinned = togglePin(pinned, brandId);
    try {
      localStorage.setItem(PINS_KEY, JSON.stringify(pinned));
    } catch {
      return;
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
      .then((body: { brands: PanelBrand[]; projectBrandId: string | null }) => {
        if (!live) {
          return;
        }
        brands = body.brands;
        projectBrandId = body.projectBrandId;
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
    {#key open.id}
      <BrandKit {projectId} brand={open} />
    {/key}
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
