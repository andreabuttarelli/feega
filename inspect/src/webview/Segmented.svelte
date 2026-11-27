<script lang="ts" generics="T extends string">
  let { options, value = $bindable(), label }: { options: { value: T; label: string }[]; value: T; label: string } = $props();
</script>

<div class="segmented" role="radiogroup" aria-label={label} data-testid="segmented">
  {#each options as option (option.value)}
    <button type="button" role="radio" aria-checked={value === option.value} class:on={value === option.value} onclick={() => (value = option.value)}>{option.label}</button>
  {/each}
</div>

<style>
  .segmented {
    display: flex;
    gap: 2px;
    height: 28px;
    padding: 2px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }

  button {
    flex: 1;
    min-width: 0;
    padding: 0 8px;
    border: 0;
    border-radius: 3px;
    background: none;
    color: var(--ui-text-2);
    font: inherit;
    font-size: var(--ui-text-sm);
    white-space: nowrap;
    cursor: pointer;
  }

  button.on {
    background: var(--ui-thumb);
    color: var(--ui-thumb-ink);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
  }
</style>
