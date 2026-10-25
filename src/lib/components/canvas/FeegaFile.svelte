<script lang="ts">
  import { FEEGA_ACCEPT, importFeega, saveFeega } from '$lib/canvas/feega-transfer';

  let { page }: { page: string } = $props();

  let input = $state<HTMLInputElement | null>(null);
  let busy = $state(false);
  let failure = $state<string | null>(null);

  export function pick() {
    if (!busy) {
      input?.click();
    }
  }

  export async function take(file: File) {
    if (busy) {
      return;
    }
    busy = true;
    failure = await importFeega(page, file);
    busy = false;
  }

  export async function save() {
    failure = await saveFeega(page);
  }

  function picked(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    target.value = '';
    if (file) {
      void take(file);
    }
  }
</script>

<input bind:this={input} class="sr-only" type="file" accept={FEEGA_ACCEPT} tabindex="-1" aria-hidden="true" data-testid="feega-import-input" onchange={picked} />

{#if busy}
  <p class="feega-notice" role="status" data-testid="feega-import-busy">Importing the .feega file…</p>
{:else if failure}
  <p class="feega-notice is-error" role="alert" data-testid="feega-file-error">
    {failure}
    <button type="button" onclick={() => (failure = null)}>Dismiss</button>
  </p>
{/if}

<style>
  .feega-notice {
    position: fixed;
    left: 50%;
    bottom: 24px;
    z-index: 60;
    transform: translateX(-50%);
    display: flex;
    gap: 12px;
    align-items: center;
    max-width: calc(100vw - 32px);
    margin: 0;
    padding: 8px 12px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-lg);
    background: var(--ui-raised);
    color: var(--ui-ink);
    font-size: 13px;
  }

  .is-error {
    border-color: var(--ui-danger);
  }

  button {
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-ink-2);
    font: inherit;
    cursor: pointer;
  }
</style>
