<script lang="ts">
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import Keyboard from '@lucide/svelte/icons/keyboard';
  import { CANVAS_SHORTCUTS } from '$lib/canvas/shortcuts';

  const isMac =
    typeof navigator !== 'undefined' &&
    /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

  const keyLabel = (k: string) => (k === 'mod' ? (isMac ? '⌘' : 'Ctrl') : k);
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger class="shortcuts-btn" aria-label="Scorciatoie da tastiera" title="Scorciatoie da tastiera">
    <Keyboard size={15} strokeWidth={1.7} />
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="start" class="max-h-[60vh] w-72 overflow-y-auto">
    <ul class="keys">
      {#each CANVAS_SHORTCUTS as row, i (row.id + i)}
        <li>
          <span>{row.label}</span>
          <span class="combo">
            {#each row.keys as k (k)}<kbd>{keyLabel(k)}</kbd>{/each}
          </span>
        </li>
      {/each}
    </ul>
  </DropdownMenu.Content>
</DropdownMenu.Root>

<style>
  :global(.shortcuts-btn) {
    display: inline-flex;
    align-items: center;
    padding: 6px;
    color: var(--ink-soft, #6e6e73);
    background: none;
    border: none;
    cursor: pointer;
  }
  :global(.shortcuts-btn:hover) {
    color: var(--ink, #1d1d1f);
  }
  .keys {
    margin: 0;
    padding: 2px;
    list-style: none;
  }
  .keys li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 5px 8px;
    font-size: 12.5px;
  }
  .combo {
    display: inline-flex;
    gap: 3px;
    flex-shrink: 0;
  }
  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border: 1px solid var(--line, #e5e5e5);
    background: var(--paper-2, #f9f9f9);
    font-family: inherit;
    font-size: 11px;
    color: var(--ink-soft, #6e6e73);
  }
</style>
