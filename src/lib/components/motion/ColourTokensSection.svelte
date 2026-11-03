<script lang="ts">
  import ColorField from './ColorField.svelte';
  import { ColourDisplay } from '$lib/motion/colour-field';
  import { colourTokens, recolouredCollection } from '$lib/motion/variable-library';
  import { variableLibrary } from '$lib/canvas/variable-library.svelte';

  const HEX = /^#[0-9a-fA-F]{6}$/;

  const tokens = $derived(colourTokens(variableLibrary.collections));

  function recolour(collection: string, name: string, colour: string) {
    const shared = variableLibrary.collections[collection];
    const next = shared ? recolouredCollection(shared, name, colour) : null;
    if (next) {
      void variableLibrary.push(collection, next);
    }
  }
</script>

{#if tokens.length}
  <section class="tokens" data-testid="colour-tokens">
    <header>Colour tokens</header>
    {#each tokens as token (token.key)}
      <div class="row" data-testid={`colour-token-${token.key}`}>
        <ColorField name={token.key} display={ColourDisplay.Chip} value={HEX.test(token.colour) ? token.colour : '#000000'} onchange={(c) => recolour(token.collection, token.name, c)} />
        <span class="name" title={token.key}>{token.key}</span>
        <output class="value">{token.colour}</output>
      </div>
    {/each}
  </section>
{/if}

<style>
  .tokens {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--ui-space-2) var(--ui-space-3);
    border-top: 1px solid var(--ui-line);
  }

  header {
    padding: 4px 0;
    color: var(--ui-text-tertiary);
    font-size: var(--ui-type-caption);
    font-weight: 600;
  }

  .row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--ui-space-2);
    min-height: 28px;
    font-size: var(--ui-type-caption);
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ui-text);
  }

  .value {
    color: var(--ui-text-tertiary);
    font-family: var(--ui-mono);
  }
</style>
