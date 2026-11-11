<script lang="ts">
  import { PROMPT_KINDS, PROMPT_KIND_ORDER, type PromptKind } from '$lib/home/prompt-kinds';

  let { kind = $bindable() }: { kind: PromptKind } = $props();
</script>

<div class="kinds" role="group" aria-label="What to make" data-testid="prompt-kinds">
  {#each PROMPT_KIND_ORDER as option (option)}
    <button type="button" data-kind={option} aria-pressed={kind === option} onclick={() => (kind = option)}>{PROMPT_KINDS[option].label}</button>
  {/each}
</div>

<style>
  .kinds {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--ui-space-1);
  }

  button {
    height: var(--ui-row);
    padding: 0 var(--ui-space-3);
    border: 0;
    border-radius: var(--ui-radius-full);
    background: var(--ui-input);
    color: var(--ui-text-secondary);
    font: inherit;
    font-size: var(--ui-type-label);
    cursor: pointer;
    transition: background var(--ui-dur-fast) var(--ui-ease), color var(--ui-dur-fast) var(--ui-ease);
  }

  button:hover {
    background: var(--ui-input-hover);
    color: var(--ui-text);
  }

  button[aria-pressed='true'] {
    background: var(--ui-accent-solid);
    color: var(--ui-on-accent);
  }

  button:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  @media (pointer: coarse) {
    button {
      height: 44px;
    }
  }
</style>
