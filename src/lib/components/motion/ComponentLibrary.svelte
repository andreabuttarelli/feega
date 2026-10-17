<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
  import X from '@lucide/svelte/icons/x';
  import type { AssetKind } from '$lib/motion/components';
  import { FIELD_INPUT, FOCUS_RING, IconButton, IconSize, Kbd, Panel, PanelHeader, SegmentedControl, Surface, Tone, type SegmentOption } from '$lib/components/ui/shell';
  import { cn } from '$lib/utils.js';
  import ComponentDetail from './ComponentDetail.svelte';
  import type { MediaUploader } from './media-upload';
  import { FORMATS, MotionFormat } from '$lib/motion/doc';
  import { Dismiss, dismissFrom, spatialStep } from '$lib/motion/template/browser';
  import { DocMode } from '$lib/motion/still';
  import type { SectionRole } from '$lib/motion/template/card';
  import { ADD_TARGET, AddTarget, byShape, matching, metaLine, rolesIn, type CatalogueItem } from '$lib/motion/template/catalogue';
  import type { Instance } from '$lib/motion/template/library';

  type Asset = { id: string; kind: string; label: string; previewUrl: string };

  let {
    items,
    format,
    draftOf,
    compose = null,
    assets = [],
    upload = null,
    target = AddTarget.Video,
    onpick,
    onclose
  }: {
    items: CatalogueItem[];
    format: MotionFormat;
    draftOf: (id: string, format: MotionFormat) => Instance | null;
    compose?: ((doc: Instance['doc']) => string) | null;
    assets?: Asset[];
    upload?: MediaUploader | null;
    target?: AddTarget;
    onpick: (id: string, sounds: boolean, draft: Instance | null) => void;
    onclose: () => void;
  } = $props();

  const ALL = 'all';
  const MODES: SegmentOption[] = [
    { value: ALL, label: 'All' },
    { value: DocMode.Video, label: 'Video' },
    { value: DocMode.Still, label: 'Still' }
  ];

  const CARD_MIN_PX: Record<MotionFormat, number> = {
    [MotionFormat.Landscape]: 280,
    [MotionFormat.Vertical]: 150,
    [MotionFormat.Portrait]: 180,
    [MotionFormat.Poster]: 170,
    [MotionFormat.Square]: 200,
    [MotionFormat.SquareLarge]: 200
  };

  const PHONE_COLUMNS: Record<MotionFormat, string> = {
    [MotionFormat.Landscape]: 'max-sm:grid-cols-1',
    [MotionFormat.Vertical]: 'max-sm:grid-cols-2',
    [MotionFormat.Portrait]: 'max-sm:grid-cols-2',
    [MotionFormat.Poster]: 'max-sm:grid-cols-2',
    [MotionFormat.Square]: 'max-sm:grid-cols-2',
    [MotionFormat.SquareLarge]: 'max-sm:grid-cols-2'
  };

  const HOVER = '(hover: hover)';

  let query = $state('');
  let mode = $state<DocMode | null>(null);
  let role = $state<SectionRole | null>(null);
  let openId = $state<string | null>(null);
  let playing = $state<string | null>(null);
  let grid = $state<HTMLDivElement | null>(null);
  let search = $state<HTMLInputElement | null>(null);
  const loaded = new SvelteSet<string>();

  const roles = $derived(rolesIn(matching(items, '', null, mode)));
  const shown = $derived(matching(items, query, null, mode, role));
  const groups = $derived(byShape(shown));
  const ordered = $derived(groups.flatMap((g) => g.items));
  const open = $derived(items.find((i) => i.id === openId) ?? null);
  const filtered = $derived(Boolean(query.trim() || mode || role));

  onMount(() => {
    if (matchMedia(HOVER).matches) {
      search?.focus();
    }
  });

  const cards = () => [...(grid?.querySelectorAll<HTMLButtonElement>('[data-component]') ?? [])];

  function pick(item: CatalogueItem) {
    onpick(item.id, ADD_TARGET[target].sounds, null);
  }

  function setMode(value: string) {
    const next = value === ALL ? null : (value as DocMode);
    mode = next;
    if (role && !rolesIn(matching(items, '', null, next)).includes(role)) {
      role = null;
    }
  }

  function clearFilters() {
    query = '';
    mode = null;
    role = null;
    search?.focus();
  }

  function preview(id: string) {
    if (matchMedia(HOVER).matches) {
      playing = id;
    }
  }

  function rest(id: string) {
    if (playing === id) {
      playing = null;
    }
  }

  function ready(img: HTMLImageElement, id: string) {
    const done = () => loaded.add(id);
    if (img.complete && img.naturalWidth) {
      done();
      return;
    }
    img.addEventListener('load', done, { once: true });
  }

  async function closeDetail() {
    const id = openId;
    openId = null;
    await tick();
    cards().find((c) => c.dataset.component === id)?.focus();
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') {
      return;
    }
    e.preventDefault();
    if (dismissFrom(openId) === Dismiss.Detail) {
      void closeDetail();
      return;
    }
    onclose();
  }

  function fromSearch(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown') {
      return;
    }
    e.preventDefault();
    cards()[0]?.focus();
  }

  function move(e: KeyboardEvent, at: number) {
    const all = cards();
    const next = spatialStep(
      all.map((c) => c.getBoundingClientRect()),
      at,
      e.key
    );
    if (next === null) {
      return;
    }
    e.preventDefault();
    all[next]?.focus();
  }
</script>

<svelte:window {onkeydown} />

<div class="fixed inset-0 z-70 bg-black/40" role="presentation" onclick={onclose}></div>
<Panel
  surface={Surface.Raised}
  role="dialog"
  aria-modal="true"
  aria-label="Frame templates"
  data-testid="component-library"
  class={cn(
    'fixed inset-0 z-71 grid grid-cols-[minmax(0,1fr)] overflow-hidden sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(860px,calc(100dvh-48px))] sm:w-[min(1240px,calc(100vw-48px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg',
    open && 'sm:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]'
  )}
>
  <div class="flex min-h-0 flex-col">
    <PanelHeader title="Frame templates">
      {#snippet actions()}
        <IconButton label="Close" shortcut="Escape" size={IconSize.Lg} onclick={onclose}><X /></IconButton>
      {/snippet}
    </PanelHeader>

    <div class="flex flex-col gap-2 px-3 pt-3 sm:flex-row sm:items-center">
      <input
        bind:this={search}
        type="search"
        placeholder="Search frame templates"
        aria-label="Search frame templates"
        bind:value={query}
        onkeydown={fromSearch}
        data-testid="component-search"
        class={cn(FIELD_INPUT, 'h-8 flex-1 text-base sm:text-ui-body')}
      />
      <SegmentedControl label="Video or still" options={MODES} value={mode ?? ALL} onchange={setMode} class="sm:w-56" />
    </div>

    {#if roles.length}
      <div class="-mx-0.5 flex gap-1 overflow-x-auto px-3 pt-2 [scrollbar-width:none]" role="group" aria-label="Role">
        {#each roles as r (r)}
          <button
            type="button"
            aria-pressed={role === r}
            data-role={r}
            onclick={() => (role = role === r ? null : r)}
            class={cn('h-6 shrink-0 rounded-full px-2.5 text-ui-label text-ui-text-2 transition-colors duration-(--ui-dur-fast) hover:bg-ui-wash hover:text-ui-text aria-pressed:bg-ui-selected aria-pressed:text-ui-accent-text pointer-coarse:h-9', FOCUS_RING)}
          >
            {r}
          </button>
        {/each}
      </div>
    {/if}

    <div class="flex min-h-0 flex-1 flex-col gap-8 overflow-auto px-3 pt-4 pb-8" bind:this={grid} data-testid="component-grid">
      {#each groups as g (g.format)}
        <section data-shape={FORMATS[g.format].label} aria-label={FORMATS[g.format].label}>
          <ul class={cn('grid list-none grid-cols-[repeat(auto-fill,minmax(min(var(--card-min),100%),1fr))] gap-x-3 gap-y-5 p-0', PHONE_COLUMNS[g.format])} style:--card-min={`${CARD_MIN_PX[g.format]}px`}>
            {#each g.items as item (item.id)}
              {@const at = ordered.indexOf(item)}
              <li class="group relative">
                <button
                  type="button"
                  class="flex w-full cursor-pointer flex-col text-left outline-none"
                  aria-label={`Add ${item.name}`}
                  data-component={item.id}
                  data-mode={item.mode}
                  onclick={() => pick(item)}
                  onkeydown={(e) => move(e, at)}
                  onpointerenter={() => preview(item.id)}
                  onpointerleave={() => rest(item.id)}
                  onfocus={() => preview(item.id)}
                  onblur={() => rest(item.id)}
                >
                  <span
                    class={cn('thumb relative block w-full overflow-hidden rounded-md bg-ui-sunken', item.id === openId && 'shadow-[var(--ui-ring)]', (!item.preview || loaded.has(item.id)) && 'ready')}
                    style:aspect-ratio={`${FORMATS[item.format].width} / ${FORMATS[item.format].height}`}
                  >
                    {#if item.preview}
                      <img src={item.preview.poster} alt="" loading="lazy" decoding="async" use:ready={item.id} class="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-(--ui-dur-base) [.ready>&]:opacity-100" />
                      {#if playing === item.id && item.preview.video}<video src={item.preview.video} poster={item.preview.poster} muted loop playsinline autoplay preload="auto" class="absolute inset-0 size-full object-cover"></video>{/if}
                    {:else}
                      <span class="grid size-full place-items-center p-2 text-center text-ui-caption text-ui-text-3">{item.name}</span>
                    {/if}
                  </span>
                  <span class="mt-2 truncate text-ui-body font-medium text-ui-text">{item.name}</span>
                  <span class="mt-0.5 font-(family-name:--ui-mono) text-ui-caption text-ui-text-3 tabular-nums">{metaLine(item)}</span>
                </button>
                <IconButton
                  label={`Customise ${item.name}`}
                  tone={Tone.Filled}
                  size={IconSize.Md}
                  data-testid="template-details"
                  onclick={() => (openId = item.id)}
                  class="absolute top-2 right-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
                >
                  <SlidersHorizontal />
                </IconButton>
              </li>
            {/each}
          </ul>
        </section>
      {:else}
        <div class="flex flex-col items-start gap-3 py-8" data-testid="frame-templates-empty">
          {#if filtered}
            <p class="text-ui-body text-ui-text-2">No frame template matches.</p>
            <button type="button" onclick={clearFilters} class={cn('h-7 rounded-sm bg-ui-input px-3 text-ui-label text-ui-text hover:bg-ui-input-hover pointer-coarse:h-11', FOCUS_RING)}>Clear filters</button>
          {:else}
            <p class="text-ui-body text-ui-text-2">No frame templates yet.</p>
          {/if}
        </div>
      {/each}
    </div>

    <footer class="hidden shrink-0 items-center gap-4 border-t border-ui-divider px-3 py-2 text-ui-caption text-ui-text-3 pointer-fine:flex">
      <span class="flex items-center gap-1.5"><Kbd shortcut="ArrowUp" /><Kbd shortcut="ArrowDown" /><Kbd shortcut="ArrowLeft" /><Kbd shortcut="ArrowRight" /> move</span>
      <span class="flex items-center gap-1.5"><Kbd shortcut="Enter" /> add</span>
      <span class="flex items-center gap-1.5"><Kbd shortcut="Escape" /> close</span>
    </footer>
  </div>

  {#if open}
    <div class="absolute inset-0 z-1 bg-black/40 sm:hidden" role="presentation" onclick={closeDetail}></div>
    {#key open.id}
      <ComponentDetail item={open} {format} {draftOf} {compose} {assets} {upload} {target} onadd={(sounds, draft) => onpick(open.id, sounds, draft)} onclose={closeDetail} />
    {/key}
  {/if}
</Panel>

<style>
  .thumb:not(:global(.ready))::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, var(--ui-wash), transparent);
    animation: shimmer 1.2s ease-in-out infinite;
  }

  @keyframes shimmer {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(100%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .thumb::after {
      animation: none;
    }
  }

  button:focus-visible .thumb {
    box-shadow: var(--ui-ring);
  }

  @media (max-width: 639px) {
    :global([data-testid='component-library']) > :global(.detail) {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2;
      max-height: 88dvh;
    }
  }
</style>
