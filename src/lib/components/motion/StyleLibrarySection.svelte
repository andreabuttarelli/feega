<script lang="ts">
  import { styleLibrary } from '$lib/canvas/style-library.svelte';
  import { StyleKind, type Style } from '$lib/motion/styles-model';
  import { resolveColor, type BrandTokens } from '$lib/motion/brand';

  let { tokens }: { tokens: BrandTokens } = $props();

  const entries = $derived(Object.entries(styleLibrary.styles));
  const colourOf = (style: Style) => (style.color ? resolveColor(style.color, tokens) : '#000000');
</script>

{#if entries.length}
  <section class="library" data-testid="style-library">
    <header>Styles · canvas</header>
    {#each entries as [name, style] (name)}
      <label class="row" data-testid="style-library-row">
        <input type="color" data-testid={`style-library-colour-${name}`} value={colourOf(style)} onchange={(e) => styleLibrary.push(name, { ...style, color: e.currentTarget.value })} />
        <span class="name">{name}</span>
        <span class="kind">{style.kind === StyleKind.Text ? `${style.font ?? ''} ${style.weight ?? ''}`.trim() || 'Text' : 'Colour'}</span>
      </label>
    {/each}
  </section>
{/if}

<style>
  .library {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    padding: var(--ui-space-3) var(--ui-space-4);
    border-top: 1px solid var(--ui-line);
    font-size: var(--ui-type-caption);
  }

  header {
    font-weight: 600;
    color: var(--ui-text);
  }

  .row {
    display: grid;
    grid-template-columns: 24px 1fr auto;
    align-items: center;
    gap: var(--ui-space-2);
  }

  input {
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-xs);
    background: transparent;
  }

  .name {
    color: var(--ui-text);
  }

  .kind {
    color: var(--ui-text-tertiary);
  }
</style>
