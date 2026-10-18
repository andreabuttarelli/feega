<script lang="ts">
  import { ICON_NAMES } from '$lib/motion/icons/icons';
  import { ICON_PATHS } from '$lib/motion/icons/paths';

  let { onpick }: { onpick: (name: string) => void } = $props();

  let query = $state('');
  const shown = $derived(ICON_NAMES.filter((n) => n.includes(query.trim().toLowerCase())));
</script>

<div class="col" data-testid="icon-menu">
  <span class="menu-head">Icons</span>
  <input class="search" type="search" placeholder="Search icons" aria-label="Search icons" bind:value={query} />
  <div class="grid">
    {#each shown as name (name)}
      <button type="button" role="menuitem" title={name} aria-label={`Add ${name} icon`} data-icon={name} onclick={() => onpick(name)}>
        <svg viewBox="-0.05 -0.05 1.1 1.1" width="18" height="18" aria-hidden="true"><path d={ICON_PATHS[name]} fill="none" stroke="currentColor" stroke-width="0.0833" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
    {/each}
  </div>
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(6, 28px);
    gap: 2px;
    max-height: 220px;
    overflow-y: auto;
  }
  .grid button {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
  }
  .search {
    width: 100%;
    margin-bottom: 4px;
  }
</style>
