<script lang="ts">
  import Shuffle from '@lucide/svelte/icons/shuffle';
  import PageHeader from '$lib/components/app/PageHeader.svelte';
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
  <PageHeader title="tools" />

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
    color: var(--ui-text);
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
    border-radius: var(--ui-radius-md);
    color: inherit;
    transition: background var(--ui-dur-fast) var(--ui-ease);
    text-decoration: none;
  }

  .tool:hover {
    background: var(--ui-wash);
  }

  .tool:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  .icon {
    grid-row: 1 / -1;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
    color: var(--ui-icon-ink);
  }

  .name {
    font-size: var(--ui-type-body);
    font-weight: var(--ui-weight-medium);
  }

  .badge {
    margin-left: var(--ui-space-2);
    font-family: var(--ui-mono);
    font-size: var(--ui-type-caption);
    color: var(--ui-text-tertiary);
  }

  .description {
    font-size: var(--ui-type-label);
    color: var(--ui-text-tertiary);
  }
</style>
