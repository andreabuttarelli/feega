<script lang="ts">
  import { lower } from '../lower';
  import { CATEGORY_COPY } from './copy';
  import { categoryPath } from './paths';
  import TemplateCard from './TemplateCard.svelte';
  import { Category, Filters, Theme, type Framework, type Template } from './template';

  let { templates, filters = Filters.Full, framework }: { templates: readonly Template[]; filters?: Filters; framework?: Framework } = $props();

  const ALL = 'all';
  const MIN_TAG_USES = 2;

  let category = $state<string>(ALL);
  let tag = $state<string>(ALL);
  let theme = $state<Theme>(Theme.Dark);

  const categories = Object.values(Category);

  const tags = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const t of templates) {
      for (const name of t.tags) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }

    return [...counts.entries()].filter(([, n]) => n >= MIN_TAG_USES).map(([name]) => name).sort();
  });

  const shown = (t: Template) => (category === ALL || t.category === category) && (tag === ALL || t.tags.includes(tag));

  const visible = $derived(templates.filter(shown).length);
</script>

<div class="tpl-bar">
  {#if filters === Filters.Full}
    <div class="chips" role="group" aria-label="Category">
      <button type="button" aria-pressed={category === ALL} onclick={() => (category = ALL)}>{lower('All')}</button>
      {#each categories as c (c)}
        <button type="button" aria-pressed={category === c} onclick={() => (category = c)}>{lower(CATEGORY_COPY[c].label)}</button>
      {/each}
    </div>
  {/if}
  {#if tags.length > 0}
    <div class="chips tags" role="group" aria-label="Tags">
      <button type="button" aria-pressed={tag === ALL} onclick={() => (tag = ALL)}>{lower('Any tag')}</button>
      {#each tags as name (name)}
        <button type="button" aria-pressed={tag === name} onclick={() => (tag = name)}>{name}</button>
      {/each}
    </div>
  {/if}
  <div class="chips theme" role="group" aria-label="Thumbnail theme">
    <button type="button" aria-pressed={theme === Theme.Light} onclick={() => (theme = Theme.Light)}>{lower('Light')}</button>
    <button type="button" aria-pressed={theme === Theme.Dark} onclick={() => (theme = Theme.Dark)}>{lower('Dark')}</button>
  </div>
</div>

<p class="fine count" aria-live="polite">{visible} of {templates.length} templates</p>

<div class="tpl-grid">
  {#each templates as template (template.id)}
    <div class="cell" hidden={!shown(template)}>
      <TemplateCard {template} {theme} {framework} />
    </div>
  {/each}
</div>

{#if filters === Filters.Full}
  <p class="fine hubs">
    {#each categories as c, i (c)}{#if i > 0} · {/if}<a href={categoryPath(c)}>{lower(CATEGORY_COPY[c].label)} →</a>{/each}
  </p>
{/if}
