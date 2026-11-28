<script lang="ts">
  import type { UiNode } from '@feega/plugin-api/protocol';
  import type { Palette } from '../messages';
  import PluginNodes from './PluginNodes.svelte';
  import { fitMenu } from './structure-menu';

  type Props = {
    x: number;
    y: number;
    plugin: string;
    id: string;
    title: string;
    tree: UiNode[];
    palette: Palette;
    onsend: (plugin: string, id: string, control: string, value: string | number | boolean, live: boolean) => void;
    onclose: () => void;
  };

  let { x, y, plugin, id, title, tree, palette, onsend, onclose }: Props = $props();

  let width = $state(0);
  let height = $state(0);
  let innerWidth = $state(0);
  let innerHeight = $state(0);

  const spot = $derived(fitMenu({ x, y }, { width, height }, { width: innerWidth, height: innerHeight }));
</script>

<svelte:window bind:innerWidth bind:innerHeight onpointerdown={onclose} onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="popover" role="dialog" aria-label={title} data-testid="plugin-popover" data-plugin={plugin} data-popover={id} bind:offsetWidth={width} bind:offsetHeight={height} style={`left:${spot.x}px;top:${spot.y}px`} onpointerdown={(e) => e.stopPropagation()}>
  <PluginNodes {plugin} {id} {tree} {palette} {onsend} />
</div>

<style>
  .popover {
    position: fixed;
    z-index: 50;
    width: 280px;
    max-height: 70vh;
    padding: 8px 0;
    overflow-y: auto;
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel);
    color: var(--ui-text);
    box-shadow: 0 0 0 1px var(--ui-border), 0 8px 24px rgb(0 0 0 / 0.25);
    font-size: var(--ui-text-sm);
  }
</style>
