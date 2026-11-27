<script lang="ts">
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';

  type Props = { hint: string; testid: string; onopen: () => void };

  let { hint, testid, onopen }: Props = $props();
</script>

<button type="button" class="banner" data-testid={testid} onclick={onopen}>
  <span class="glyph"><LayoutGrid size={14} /></span>
  <span class="text">
    <b>Open canvas</b>
    <span>{hint}</span>
  </span>
  <ChevronRight size={14} />
</button>

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
    width: calc(100% - 16px);
    margin: 8px;
    padding: 8px 10px;
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-lg);
    background: var(--ui-input);
    color: var(--ui-text-2);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .banner:hover,
  .banner:focus-visible {
    border-color: var(--ui-accent);
    background: color-mix(in srgb, var(--ui-accent) 10%, var(--ui-input));
    color: var(--ui-text);
  }

  .glyph {
    display: grid;
    flex: none;
    place-items: center;
  }

  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    font-size: var(--ui-text-xs);
  }

  .text b {
    color: var(--ui-text);
    font-size: var(--ui-text-sm);
    font-weight: 500;
  }

  .text span {
    line-height: 1.3;
  }
</style>
