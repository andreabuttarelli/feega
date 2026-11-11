<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import Trash from '@lucide/svelte/icons/trash-2';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { FIELD_INPUT, FOCUS_RING, IconButton, IconSize, Kbd, SegmentedControl, type SegmentOption } from '$lib/components/ui/shell';
  import { cn } from '$lib/utils.js';
  import { spatialStep } from '$lib/motion/template/browser';
  import { catalogue, matching } from '$lib/motion/template/catalogue';
  import { filterGroup, groupItems, isOwn, shortName, Tab } from '$lib/motion/template/library-groups';
  import { postPageAction } from '$lib/api/page-action';
  import MotionPreview from './MotionPreview.svelte';
  import { newMotionDoc, MotionFormat, type MotionDoc } from '@feega/motion-core/motion/doc';
  import { insertTemplate, type TemplateEntry } from '$lib/motion/template/library';

  let {
    templates,
    doc,
    selectedComp,
    frame,
    editorUrl,
    compose,
    initial = null,
    oninsert,
    onsaved,
    onremoved,
    onclose
  }: {
    templates: TemplateEntry[];
    doc: MotionDoc;
    selectedComp: string | null;
    frame: number;
    editorUrl: string;
    compose: (doc: MotionDoc) => string;
    initial?: string | null;
    oninsert: (entry: TemplateEntry, sounds: boolean) => void;
    onsaved: (entry: TemplateEntry) => void;
    onremoved: (id: string) => void;
    onclose: () => void;
  } = $props();

  const TABS: SegmentOption[] = [
    { value: Tab.Browse, label: 'Browse' },
    { value: Tab.Save, label: 'Save selection' }
  ];

  let picked = $state<string | null>(null);
  let sounds = $state(true);
  const chosen = $derived(picked ?? initial);
  let grid = $state<HTMLDivElement | null>(null);
  let query = $state('');
  let group = $state<string | null>(null);
  let tab = $state<Tab>(Tab.Browse);

  $effect(() => {
    if (initial && grid) {
      grid.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
    }
  });
  let name = $state('');
  let description = $state('');
  let error = $state('');
  let previewFrame = $state(0);
  let previewPlaying = $state(true);

  const items = $derived(catalogue(templates));
  const groups = $derived(groupItems(items).map((g) => g.title));
  const shown = $derived(groupItems(matching(filterGroup(items, group), query, null)));
  const ordered = $derived(shown.flatMap((g) => g.items));
  const entry = $derived(templates.find((t) => t.id === chosen) ?? templates[0] ?? null);
  const item = $derived(items.find((i) => i.id === entry?.id) ?? null);
  const saveLabel = $derived(selectedComp ? 'the selected precomp' : 'the whole video');
  const sample = $derived.by(() => {
    if (!entry) {
      return null;
    }
    let n = 0;
    const blank = { ...newMotionDoc(MotionFormat.Landscape), width: doc.width, height: doc.height, fps: doc.fps, durationInFrames: entry.template.doc.durationInFrames };
    const placed = insertTemplate(blank, entry, { from: 0, newId: () => `preview${++n}` });
    return placed.ok ? placed.doc : null;
  });

  async function save() {
    const form = new FormData();
    form.set('doc', JSON.stringify(doc));
    form.set('compId', selectedComp ?? '');
    form.set('name', name);
    form.set('description', description);
    form.set('posterFrame', String(frame));
    const result = await postPageAction(editorUrl, 'saveTemplate', form);
    if (result.type !== 'success') {
      error = String((result.type === 'failure' ? result.data?.error : null) ?? 'The template could not be saved.');
      return;
    }
    error = '';
    name = '';
    description = '';
    const saved = (result.data as { entry: TemplateEntry }).entry;
    onsaved(saved);
    picked = saved.id;
    group = null;
    query = '';
    tab = Tab.Browse;
  }

  async function remove(id: string) {
    const form = new FormData();
    form.set('id', id);
    const result = await postPageAction(editorUrl, 'deleteTemplate', form);
    if (result.type === 'success') {
      onremoved(id);
    }
  }

  const cards = () => [...(grid?.querySelectorAll<HTMLButtonElement>('[data-template]') ?? [])];

  function move(e: KeyboardEvent, at: number) {
    if (e.key === 'Enter' && entry) {
      e.preventDefault();
      picked = ordered[at].id;
      const target = templates.find((t) => t.id === picked);
      if (target) {
        oninsert(target, sounds);
      }
      return;
    }
    const all = cards();
    const next = spatialStep(all.map((c) => c.getBoundingClientRect()), at, e.key);
    if (next === null) {
      return;
    }
    e.preventDefault();
    all[next]?.focus();
  }

  function insertById(id: string) {
    const target = templates.find((t) => t.id === id);
    if (target) {
      oninsert(target, sounds);
    }
  }

  function clearFilters() {
    query = '';
    group = null;
  }
</script>

<Dialog.Root open onOpenChange={(open) => !open && onclose()}>
  <Dialog.Portal>
    <Dialog.Overlay class="z-70" />
    <Dialog.Content
      showCloseButton={false}
      data-testid="template-library"
      aria-label="Templates"
      class="z-71 flex h-[min(720px,calc(100dvh-32px))] w-[min(1040px,calc(100vw-32px))] flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
    >
      <header class="flex h-(--ui-header-h) shrink-0 items-center gap-3 border-b border-ui-divider pr-1.5 pl-3">
        <Dialog.Title class="text-ui-title font-semibold tracking-[var(--ui-tracking-title)]">Templates</Dialog.Title>
        <SegmentedControl label="Templates view" options={TABS} value={tab} onchange={(v) => (tab = v as Tab)} class="ml-auto w-56" />
        <IconButton label="Close" shortcut="Escape" size={IconSize.Lg} onclick={onclose}><X /></IconButton>
      </header>

      {#if tab === Tab.Browse}
        <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-y-auto md:grid-cols-[minmax(0,1fr)_340px] md:overflow-hidden">
          <section class="flex min-h-0 flex-col" aria-label="Template list">
            <div class="flex flex-col gap-2 px-3 pt-3">
              <input
                type="search"
                placeholder="Search templates"
                aria-label="Search templates"
                bind:value={query}
                data-testid="template-search"
                class={cn(FIELD_INPUT, 'h-8 text-base sm:text-ui-body')}
              />
              {#if groups.length > 1}
                <div class="flex gap-1 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Group">
                  {#each groups as g (g)}
                    <button
                      type="button"
                      aria-pressed={group === g}
                      onclick={() => (group = group === g ? null : g)}
                      class={cn('h-6 shrink-0 rounded-full px-2.5 text-ui-label text-ui-text-2 transition-colors duration-(--ui-dur-fast) hover:bg-ui-wash hover:text-ui-text aria-pressed:bg-ui-selected aria-pressed:text-ui-accent-text pointer-coarse:h-9', FOCUS_RING)}
                    >
                      {g}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>

            <div class="flex min-h-0 flex-1 flex-col gap-6 overflow-auto px-3 pt-4 pb-6" bind:this={grid} data-testid="template-grid">
              {#each shown as g (g.title)}
                <section aria-label={g.title}>
                  <h3 class="mb-2 text-ui-section font-semibold tracking-[var(--ui-tracking-caps)] text-ui-text-3 uppercase">{g.title}</h3>
                  <ul class="grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-3 gap-y-4 p-0">
                    {#each g.items as i (i.id)}
                      {@const at = ordered.indexOf(i)}
                      <li class="group relative">
                        <button
                          type="button"
                          data-template={i.id}
                          aria-current={entry?.id === i.id}
                          aria-label={`${i.name}, ${i.seconds.toFixed(1)} seconds`}
                          onclick={() => (picked = i.id)}
                          ondblclick={() => insertById(i.id)}
                          onkeydown={(e) => move(e, at)}
                          class={cn('flex w-full cursor-pointer flex-col text-left', FOCUS_RING)}
                        >
                          <span class={cn('relative block aspect-video w-full overflow-hidden rounded-md bg-ui-sunken', entry?.id === i.id && 'shadow-[var(--ui-ring)]')}>
                            {#if i.preview}
                              <img src={i.preview.poster} alt="" loading="lazy" decoding="async" class="absolute inset-0 size-full object-cover" />
                            {:else}
                              <span class="grid size-full place-items-center p-2 text-center text-ui-caption text-ui-text-3">{shortName(i)}</span>
                            {/if}
                          </span>
                          <span class="mt-1.5 truncate text-ui-body font-medium text-ui-text">{shortName(i)}</span>
                          <span class="font-(family-name:--ui-mono) text-ui-caption text-ui-text-3 tabular-nums">{i.seconds.toFixed(1)}s</span>
                        </button>
                        {#if isOwn(i.id)}
                          <IconButton
                            label="Delete template"
                            size={IconSize.Md}
                            onclick={() => remove(i.id)}
                            class="absolute top-1.5 right-1.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
                          >
                            <Trash />
                          </IconButton>
                        {/if}
                      </li>
                    {/each}
                  </ul>
                </section>
              {:else}
                <div class="flex flex-col items-start gap-3 py-8" data-testid="templates-empty">
                  {#if query.trim() || group}
                    <p class="text-ui-body text-ui-text-2">No template matches.</p>
                    <Button variant="secondary" size="sm" onclick={clearFilters}>Clear filters</Button>
                  {:else}
                    <p class="text-ui-body text-ui-text-2">No templates yet. Save a precomp to start your library.</p>
                  {/if}
                </div>
              {/each}
            </div>
          </section>

          <aside class="flex min-h-0 flex-col border-t border-ui-divider md:border-t-0 md:border-l" aria-label="Template details" data-testid="template-detail">
            {#if entry && item}
              <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
              <h3 class="m-0 text-ui-title font-semibold tracking-[var(--ui-tracking-title)] text-ui-text">{shortName(item)}</h3>
              {#if sample}
                <div class="w-full overflow-hidden rounded-md bg-ui-sunken" style={`aspect-ratio: ${sample.width} / ${sample.height};`}>
                  <MotionPreview html={compose(sample)} width={sample.width} height={sample.height} fps={sample.fps} loop muted bind:frame={previewFrame} bind:playing={previewPlaying} />
                </div>
              {/if}
              {#if item.description}<p class="m-0 text-ui-body text-ui-text-2">{item.description}</p>{/if}
              {#if item.fields.length}
                <section aria-label="Editable fields">
                  <h4 class="mb-1.5 text-ui-section font-semibold tracking-[var(--ui-tracking-caps)] text-ui-text-3 uppercase">Fields</h4>
                  <dl class="m-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-ui-label">
                    {#each item.fields as f (f.label)}
                      <dt class="truncate text-ui-text">{f.label}</dt>
                      <dd class="m-0 text-ui-text-3">{f.type}</dd>
                    {/each}
                  </dl>
                </section>
              {/if}
              </div>
              <div class="flex shrink-0 flex-col gap-3 border-t border-ui-divider p-4">
                <label class="flex cursor-pointer items-center gap-2 text-ui-body text-ui-text">
                  <input type="checkbox" bind:checked={sounds} data-testid="template-sounds" class="size-4 accent-(--ui-accent-solid)" />
                  Add its sounds (key taps, clicks)
                </label>
                <Button size="lg" data-testid="insert-template" onclick={() => oninsert(entry, sounds)}>Insert at playhead</Button>
              </div>
            {:else}
              <p class="p-4 text-ui-body text-ui-text-2">Select a template to preview it.</p>
            {/if}
          </aside>
        </div>

        <footer class="hidden shrink-0 items-center gap-4 border-t border-ui-divider px-3 py-2 text-ui-caption text-ui-text-3 pointer-fine:flex">
          <span class="flex items-center gap-1.5"><Kbd shortcut="ArrowUp" /><Kbd shortcut="ArrowDown" /><Kbd shortcut="ArrowLeft" /><Kbd shortcut="ArrowRight" /> move</span>
          <span class="flex items-center gap-1.5"><Kbd shortcut="Enter" /> insert</span>
          <span class="flex items-center gap-1.5"><Kbd shortcut="Escape" /> close</span>
        </footer>
      {:else}
        <form
          class="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 sm:max-w-md"
          onsubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <p class="m-0 text-ui-body text-ui-text-2">Save {saveLabel} to your library as a reusable template.</p>
          <label class="flex flex-col gap-1.5 text-ui-label text-ui-text">
            Name
            <input class={FIELD_INPUT} bind:value={name} maxlength="60" required data-testid="template-name" />
          </label>
          <label class="flex flex-col gap-1.5 text-ui-label text-ui-text">
            Description
            <input class={FIELD_INPUT} bind:value={description} maxlength="200" data-testid="template-description" />
          </label>
          <div class="flex items-center gap-3">
            <Button type="submit" disabled={!name.trim()} data-testid="save-template">Save to library</Button>
            {#if !name.trim()}<span class="text-ui-caption text-ui-text-3">Enter a name to save.</span>{/if}
          </div>
          {#if error}<p class="m-0 text-ui-label text-ui-danger" role="alert">{error}</p>{/if}
        </form>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
