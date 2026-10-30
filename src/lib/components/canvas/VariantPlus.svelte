<script lang="ts">
  const GAP_PX = 8;
  const SIZE_PX = 24;

  let { rect, onadd }: { rect: { left: number; top: number; width: number; height: number }; onadd: () => void } = $props();
</script>

<button
  type="button"
  class="variant-plus"
  data-testid="variant-plus"
  aria-label="Add variant"
  title="Add variant"
  style={`left:${rect.left + rect.width / 2 - SIZE_PX / 2}px;top:${rect.top + rect.height + GAP_PX}px;width:${SIZE_PX}px;height:${SIZE_PX}px`}
  onpointerdown={(e) => e.stopPropagation()}
  onclick={(e) => {
    e.stopPropagation();
    onadd();
  }}>+</button>

<style>
  .variant-plus {
    position: absolute;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px dashed var(--ui-component, #9747ff);
    border-radius: var(--ui-radius-full, 999px);
    background: var(--ui-surface, #fff);
    color: var(--ui-component, #9747ff);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    pointer-events: auto;
  }

  .variant-plus:hover {
    background: var(--ui-component, #9747ff);
    color: #fff;
  }
</style>
