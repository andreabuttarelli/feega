<script lang="ts">
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import { chevronTurn, type Box, type Edge } from './dock';

  let { edge, box, onrestore }: { edge: Edge; box: Box; onrestore: () => void } = $props();
</script>

<button type="button" class="tab" data-edge={edge} data-testid="dock-tab" title="Show the toolbar" aria-label="Show the toolbar" style={`left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px`} onclick={onrestore}>
  <span style={`display:grid;transform:rotate(${chevronTurn(edge)}deg)`}><ChevronUp size={14} /></span>
</button>

<style>
  .tab {
    position: fixed;
    z-index: 5;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    background: var(--ui-float);
    box-shadow: 0 0 0 1px var(--ui-divider), 0 4px 12px rgb(0 0 0 / 0.18);
    color: var(--ui-text);
    cursor: pointer;
    animation: appear 180ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .tab[data-edge='top'] {
    border-radius: 0 0 var(--ui-radius-md) var(--ui-radius-md);
  }

  .tab[data-edge='bottom'] {
    border-radius: var(--ui-radius-md) var(--ui-radius-md) 0 0;
  }

  .tab[data-edge='left'] {
    border-radius: 0 var(--ui-radius-md) var(--ui-radius-md) 0;
  }

  .tab[data-edge='right'] {
    border-radius: var(--ui-radius-md) 0 0 var(--ui-radius-md);
  }

  .tab:focus-visible {
    outline: 1px solid var(--ui-accent);
  }

  @keyframes appear {
    from {
      opacity: 0;
    }
  }
</style>
