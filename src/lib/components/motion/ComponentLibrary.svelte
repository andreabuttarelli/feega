<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
  import type { AssetKind } from '$lib/motion/components';
  import IconButton from './IconButton.svelte';
  import ComponentDetail from './ComponentDetail.svelte';
  import { Action } from '$lib/motion/actions';
  import { FORMATS, MotionFormat } from '$lib/motion/doc';
  import { Dismiss, dismissFrom, spatialStep } from '$lib/motion/template/browser';
  import { DocMode } from '$lib/motion/still';
  import type { SectionRole } from '$lib/motion/template/card';
  import { ADD_TARGET, AddTarget, byShape, matching, metaLine, rolesIn, type CatalogueItem, type StarterFormat } from '$lib/motion/template/catalogue';
  import type { Instance } from '$lib/motion/template/library';

  type Asset = { id: string; kind: AssetKind; label: string; previewUrl: string };

  let {
    items,
    format,
    draftOf,
    compose = null,
    assets = [],
    target = AddTarget.Video,
    onpick,
    onclose
  }: {
    items: CatalogueItem[];
    format: StarterFormat;
    draftOf: (id: string, format: StarterFormat) => Instance | null;
    compose?: ((doc: Instance['doc']) => string) | null;
    assets?: Asset[];
    target?: AddTarget;
    onpick: (id: string, sounds: boolean, draft: Instance | null) => void;
    onclose: () => void;
  } = $props();

  const MODE_LABEL: Record<DocMode, string> = { [DocMode.Video]: 'Video', [DocMode.Still]: 'Still' };

  const CARD_MIN_PX: Record<MotionFormat, number> = {
    [MotionFormat.Landscape]: 280,
    [MotionFormat.Vertical]: 150,
    [MotionFormat.Portrait]: 180,
    [MotionFormat.Poster]: 170,
    [MotionFormat.Square]: 200,
    [MotionFormat.SquareLarge]: 200
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

  function setMode(next: DocMode | null) {
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

<div class="scrim" role="presentation" onclick={onclose}></div>
<div class="dialog" class:open={Boolean(open)} role="dialog" aria-modal="true" aria-label="Frame templates" data-testid="component-library">
  <div class="browse">
    <header>
      <h2>frame templates</h2>
      <IconButton action={Action.Close} onclick={onclose} />
    </header>

    <div class="bar">
      <input bind:this={search} type="search" placeholder="Search frame templates" aria-label="Search frame templates" bind:value={query} onkeydown={fromSearch} data-testid="component-search" />
      <div class="segmented" role="tablist" aria-label="Video or still">
        <button type="button" role="tab" aria-selected={mode === null} class:on={mode === null} onclick={() => setMode(null)}>All</button>
        {#each Object.values(DocMode) as m (m)}
          <button type="button" role="tab" aria-selected={mode === m} class:on={mode === m} data-mode-tab={m} onclick={() => setMode(m)}>{MODE_LABEL[m]}</button>
        {/each}
      </div>
    </div>

    {#if roles.length}
      <div class="roles" role="group" aria-label="Role">
        {#each roles as r (r)}
          <button type="button" aria-pressed={role === r} class:on={role === r} data-role={r} onclick={() => (role = role === r ? null : r)}>{r}</button>
        {/each}
      </div>
    {/if}

    <div class="scroll" bind:this={grid} data-testid="component-grid">
      {#each groups as g (g.native)}
        <section data-shape={FORMATS[g.native].label} aria-label={FORMATS[g.native].label}>
          <ul class="grid" style:--card-min={`${CARD_MIN_PX[g.native]}px`}>
            {#each g.items as item (item.id)}
              {@const at = ordered.indexOf(item)}
              <li class="card" class:on={item.id === openId}>
                <button
                  type="button"
                  class="pick"
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
                  <span class="thumb" class:ready={!item.preview || loaded.has(item.id)} style:aspect-ratio={`${FORMATS[item.native].width} / ${FORMATS[item.native].height}`}>
                    {#if item.preview}
                      <img src={item.preview.poster} alt="" loading="lazy" decoding="async" use:ready={item.id} />
                      {#if playing === item.id && item.preview.video}<video src={item.preview.video} poster={item.preview.poster} muted loop playsinline autoplay preload="auto"></video>{/if}
                    {:else}
                      <span class="blank">{item.name}</span>
                    {/if}
                  </span>
                  <span class="name">{item.name}</span>
                  <span class="meta">{metaLine(item)}</span>
                </button>
                <button type="button" class="more" aria-label={`Customise ${item.name}`} data-testid="template-details" onclick={() => (openId = item.id)}>
                  <SlidersHorizontal size={14} />
                </button>
              </li>
            {/each}
          </ul>
        </section>
      {:else}
        <div class="none" data-testid="frame-templates-empty">
          {#if filtered}
            <p>No frame template matches.</p>
            <button type="button" onclick={clearFilters}>Clear filters</button>
          {:else}
            <p>No frame templates yet.</p>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  {#if open}
    <div class="sheet-scrim" role="presentation" onclick={closeDetail}></div>
    {#key open.id}
      <ComponentDetail item={open} {format} {draftOf} {compose} {assets} {target} onadd={(sounds, draft) => onpick(open.id, sounds, draft)} onclose={closeDetail} />
    {/key}
  {/if}
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgb(0 0 0 / 0.5);
  }

  .dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(1240px, calc(100vw - 48px));
    height: min(860px, calc(100dvh - 48px));
    z-index: 41;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    background: var(--ui-bg);
    color: var(--ui-ink);
    box-shadow: 0 24px 80px rgb(0 0 0 / 0.25);
  }

  .dialog.open {
    grid-template-columns: minmax(0, 1fr) minmax(320px, 400px);
  }

  .browse {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: var(--ui-space-6) var(--ui-space-6) 0;
    gap: var(--ui-space-4);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ui-space-4);
  }

  h2 {
    margin: 0;
    font-size: 32px;
    font-weight: 600;
    line-height: 0.95;
    letter-spacing: -0.04em;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: var(--ui-space-3);
  }

  .bar input {
    flex: 1;
    min-width: 0;
    height: 40px;
    padding: 0 var(--ui-space-3);
    border: 0;
    background: var(--ui-field);
    color: inherit;
    font: inherit;
    font-size: 16px;
  }

  .bar input:focus-visible {
    outline: none;
    box-shadow: var(--ui-focus);
  }

  .segmented {
    flex: none;
    display: flex;
    padding: 3px;
    border-radius: 9999px;
    background: var(--ui-field);
  }

  .segmented button {
    height: 34px;
    padding: 0 16px;
    border: 0;
    border-radius: 9999px;
    background: none;
    color: var(--ui-ink-2);
    font: inherit;
    font-size: var(--ui-text-md);
    cursor: pointer;
  }

  .segmented button.on {
    background: var(--ui-bg);
    color: var(--ui-ink);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.12);
  }

  .roles {
    display: flex;
    gap: var(--ui-space-1);
    overflow-x: auto;
    scrollbar-width: none;
    margin: 0 calc(-1 * var(--ui-space-2));
  }

  .roles button {
    flex: none;
    height: 30px;
    padding: 0 var(--ui-space-3);
    border: 0;
    border-radius: 9999px;
    background: none;
    color: var(--ui-ink-2);
    font: inherit;
    font-size: var(--ui-text-md);
    cursor: pointer;
  }

  .roles button:hover {
    background: var(--ui-hover);
  }

  .roles button.on {
    background: var(--ui-accent-wash);
    color: var(--ui-accent);
  }

  .segmented button:focus-visible,
  .roles button:focus-visible,
  .none button:focus-visible {
    outline: none;
    box-shadow: var(--ui-focus);
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: var(--ui-space-1) 0 var(--ui-space-8);
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-8);
  }

  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(var(--card-min), 100%), 1fr));
    gap: var(--ui-space-6) var(--ui-space-4);
    align-items: start;
  }

  .card {
    position: relative;
  }

  .pick {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .pick:focus-visible {
    outline: none;
  }

  .pick:focus-visible .thumb,
  .card.on .thumb {
    box-shadow: var(--ui-focus);
  }

  .thumb {
    position: relative;
    display: block;
    width: 100%;
    overflow: hidden;
    background: var(--ui-surface);
  }

  .thumb:not(.ready)::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, var(--ui-hover), transparent);
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
    .thumb:not(.ready)::after {
      animation: none;
    }
  }

  img,
  video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  img {
    opacity: 0;
    transition: opacity 200ms ease-out;
  }

  .thumb.ready img {
    opacity: 1;
  }

  .pick:hover .thumb img,
  .pick:hover .thumb video {
    transform: scale(1.02);
    transition:
      transform 400ms cubic-bezier(0.16, 1, 0.3, 1),
      opacity 200ms ease-out;
  }

  .blank {
    display: grid;
    place-items: center;
    height: 100%;
    padding: var(--ui-space-2);
    font-size: var(--ui-text-sm);
    color: var(--ui-text-3);
    text-align: center;
  }

  .name {
    margin-top: var(--ui-space-2);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: var(--ui-text-lg);
    font-weight: 500;
    letter-spacing: -0.01em;
  }

  .meta {
    margin-top: 2px;
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    color: var(--ui-text-2);
  }

  .more {
    position: absolute;
    top: var(--ui-space-2);
    right: var(--ui-space-2);
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 9999px;
    background: rgb(0 0 0 / 0.55);
    color: #fff;
    opacity: 0;
    cursor: pointer;
    transition: opacity 150ms ease-out;
  }

  .card:hover .more,
  .card:focus-within .more,
  .more:focus-visible {
    opacity: 1;
  }

  .more:focus-visible {
    outline: none;
    box-shadow: var(--ui-focus);
  }

  @media (hover: none) {
    .more {
      opacity: 1;
    }
  }

  .none {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ui-space-3);
    padding: var(--ui-space-8) 0;
    color: var(--ui-ink-2);
  }

  .none p {
    margin: 0;
    font-size: var(--ui-text-lg);
  }

  .none button {
    height: 36px;
    padding: 0 var(--ui-space-4);
    border: 0;
    border-radius: 9999px;
    background: var(--ui-field);
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-md);
    cursor: pointer;
  }

  .sheet-scrim {
    display: none;
  }

  @media (max-width: 640px) {
    .dialog,
    .dialog.open {
      inset: 0;
      transform: none;
      width: 100vw;
      height: 100dvh;
      box-shadow: none;
      grid-template-columns: minmax(0, 1fr);
    }

    .browse {
      padding: var(--ui-space-4) var(--ui-space-4) 0;
      gap: var(--ui-space-3);
    }

    h2 {
      font-size: 28px;
    }

    .bar {
      flex-direction: column;
      align-items: stretch;
    }

    .segmented button {
      flex: 1;
      height: 38px;
    }

    .roles button {
      height: 36px;
    }

    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--ui-space-4) var(--ui-space-3);
    }

    section[data-shape='16:9'] .grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .sheet-scrim {
      display: block;
      position: absolute;
      inset: 0;
      z-index: 1;
      background: rgb(0 0 0 / 0.4);
    }

    .dialog > :global(.detail) {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2;
      max-height: 88dvh;
    }
  }
</style>
