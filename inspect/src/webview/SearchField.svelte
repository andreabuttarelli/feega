<script lang="ts">
  type Props = { label: string; value: string; placeholder: string; onsearch: (text: string) => void };

  let { label, value, placeholder, onsearch }: Props = $props();

  let text = $state('');
  let input = $state<HTMLInputElement>();

  $effect(() => {
    if (document.activeElement !== input) {
      text = value;
    }
  });
</script>

<input bind:this={input} bind:value={text} type="search" spellcheck="false" aria-label={label} {placeholder} oninput={() => onsearch(text)} />

<style>
  input {
    height: 28px;
    min-width: 0;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background-color: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
  }
</style>
