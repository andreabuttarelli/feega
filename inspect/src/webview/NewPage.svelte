<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus';
  import type { LibraryEntry } from '../messages';

  type Props = { items: LibraryEntry[]; onopen: () => void; oncreate: (route: string, item: string | null) => void };

  const SECTION = 'section';
  const FREE = 'free';
  const BLANK = '';

  let { items, onopen, oncreate }: Props = $props();

  let open = $state(false);
  let route = $state('');
  let item = $state(BLANK);

  const sections = $derived(items.filter((entry) => entry.category === SECTION && entry.tier === FREE));

  function toggle() {
    open = !open;
    if (open) {
      onopen();
    }
  }

  function create(event: Event) {
    event.preventDefault();
    if (!route.trim()) {
      return;
    }
    oncreate(route, item === BLANK ? null : item);
    route = '';
    item = BLANK;
    open = false;
  }
</script>

<div class="new-page">
  <button type="button" class="icon" class:on={open} title="New page" aria-label="New page" data-testid="new-page" onclick={toggle}><Plus size={14} /></button>
  {#if open}
    <form class="panel" onsubmit={create}>
      <label>
        <span>Route</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input bind:value={route} placeholder="about" spellcheck="false" autofocus data-testid="new-page-route" />
      </label>
      <label>
        <span>Start from</span>
        <select bind:value={item} data-testid="new-page-template">
          <option value={BLANK}>Blank</option>
          {#each sections as entry (entry.id)}<option value={entry.id}>{entry.name}</option>{/each}
        </select>
      </label>
      <button type="submit" class="create" data-testid="new-page-create">Create page</button>
    </form>
  {/if}
</div>

<style>
  .new-page {
    position: relative;
  }

  .icon {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    flex: none;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    cursor: pointer;
  }

  .icon:hover,
  .icon.on {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .panel {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 20;
    display: grid;
    gap: 8px;
    width: 220px;
    padding: 10px;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius);
    background: var(--ui-panel);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.3);
  }

  label {
    display: grid;
    gap: 4px;
    color: var(--ui-text-2);
    font-size: var(--ui-text-sm);
  }

  input,
  select {
    height: 26px;
    padding: 0 6px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font-size: var(--ui-text-sm);
  }

  .create {
    height: 26px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-accent, #ff5100);
    color: #fff;
    font-size: var(--ui-text-sm);
    cursor: pointer;
  }
</style>
