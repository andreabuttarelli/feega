<script lang="ts">
  import { Key, ON, type DemoState } from '../script';

  let { demo }: { demo: DemoState } = $props();
</script>

<kbd class:down={demo[Key.Alt] === ON}>alt</kbd>

<style>
  kbd {
    padding: 4px 12px;
    border-radius: 6px;
    background: #2b2b2b;
    box-shadow: 0 2px 0 #000000;
    color: #cccccc;
    font: 500 12px -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    opacity: 0.35;
    transition:
      opacity 0.3s cubic-bezier(0.87, 0, 0.13, 1),
      transform 0.3s cubic-bezier(0.87, 0, 0.13, 1);
  }

  kbd.down {
    background: #ff8a3d;
    box-shadow: none;
    color: #1a0a00;
    opacity: 1;
    transform: translateY(2px);
  }
</style>
