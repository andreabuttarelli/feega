<script lang="ts">
  let { text }: { text: string } = $props();

  let shown = $state('');

  $effect(() => {
    if (text) {
      shown = text;
    }
  });
</script>

<code class="chip" class:on={text !== ''}>{shown}</code>

<style>
  .chip {
    position: absolute;
    bottom: 12px;
    left: 50%;
    z-index: 4;
    max-width: calc(100% - 24px);
    padding: 5px 10px;
    border-radius: 6px;
    background: #0f2a17;
    box-shadow: 0 0 0 1px #1f6b3a;
    color: #4ade80;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, 8px);
    transition:
      opacity 0.35s cubic-bezier(0.87, 0, 0.13, 1),
      transform 0.45s cubic-bezier(0.87, 0, 0.13, 1);
  }

  .chip.on {
    opacity: 1;
    transform: translate(-50%, 0);
  }
</style>
