<script lang="ts">
  import { Key, type DemoState } from '../script';

  let { demo }: { demo: DemoState } = $props();
</script>

<span class="button" class:hover={demo[Key.State] === 'Hover'}>Get started</span>

<style>
  .button {
    padding: 8px 20px;
    border-radius: 8px;
    background: #3b82f6;
    color: #ffffff;
    font: 500 13px -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    transition: background-color 0.4s cubic-bezier(0.87, 0, 0.13, 1);
  }

  .button.hover {
    background: #2563eb;
  }
</style>
