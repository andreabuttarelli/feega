<script lang="ts">
  let { onadd }: { onadd: () => void } = $props();
</script>

<div class="set-outline" data-testid="component-set-outline"></div>
<button
  type="button"
  class="set-plus"
  data-testid="component-set-plus"
  aria-label="Add variant"
  title="Add variant"
  onpointerdown={(e) => e.stopPropagation()}
  onclick={(e) => {
    e.stopPropagation();
    onadd();
  }}>+</button>

<style>
  .set-outline {
    position: absolute;
    inset: -6px;
    border: 1px dashed var(--ui-component, #9747ff);
    border-radius: var(--ui-radius-sm, 4px);
    pointer-events: none;
  }

  .set-plus {
    position: absolute;
    left: 50%;
    top: calc(100% + 14px);
    width: 24px;
    height: 24px;
    translate: -50% 0;
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

  .set-plus:hover {
    background: var(--ui-component, #9747ff);
    color: #fff;
  }
</style>
