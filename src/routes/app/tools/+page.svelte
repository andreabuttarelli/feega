<script lang="ts">
  import Shuffle from '@lucide/svelte/icons/shuffle';
  import PageTitle from '$lib/components/PageTitle.svelte';
  import { TOOL_ICONS } from '$lib/components/app/tool-icons';
  import { toolEntries } from '$lib/tools-page';

  let { data } = $props();

  const ICONS = { ...TOOL_ICONS, gallery: Shuffle };
  const ICON = 18;
  const STROKE = 1.6;

  const entries = $derived(toolEntries(data.projects[0]?.id ?? null));
</script>

<svelte:head><title>Tools · feega</title></svelte:head>

<div class="tools">
  <PageTitle text="tools" />

  <ul data-testid="tools-list">
    {#each entries as entry (entry.id)}
      {@const Icon = ICONS[entry.icon]}
      <li>
        <a href={entry.href} class="tool" data-sveltekit-reload={entry.id === 'gallery' ? '' : undefined}>
          <span class="icon"><Icon size={ICON} strokeWidth={STROKE} /></span>
          <span class="name">{entry.name}{#if entry.badge}<span class="badge">{entry.badge}</span>{/if}</span>
          <span class="description">{entry.description}</span>
        </a>
      </li>
    {/each}
  </ul>
</div>

<style>
  .tools {
    display: flex;
    flex-direction: column;
    gap: 48px;
    max-width: 720px;
    margin: 0 auto;
    color: var(--ui-ink);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .tool {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr);
    grid-template-rows: auto auto;
    column-gap: var(--ui-space-4);
    align-items: center;
    padding: var(--ui-space-3) var(--ui-space-2);
    margin: 0 calc(-1 * var(--ui-space-2));
    color: inherit;
    text-decoration: none;
  }

  .tool:hover {
    background: var(--ui-hover);
  }

  .tool:focus-visible {
    outline: none;
    box-shadow: var(--ui-focus);
  }

  .icon {
    grid-row: 1 / -1;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 9999px;
    background: var(--ui-field);
  }

  .name {
    font-size: var(--ui-text-md);
    font-weight: 500;
  }

  .badge {
    margin-left: var(--ui-space-2);
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    color: var(--ui-text-3);
  }

  .description {
    font-size: var(--ui-text-sm);
    color: var(--ui-text-3);
  }
</style>
