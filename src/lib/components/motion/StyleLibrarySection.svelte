<script lang="ts">
  import { styleLibrary } from '$lib/canvas/style-library.svelte';
  import { StyleKind, styleSchema, type Style } from '$lib/motion/styles-model';
  import { resolveColor, type BrandTokens } from '$lib/motion/brand';

  let { tokens }: { tokens: BrandTokens } = $props();

  type TextKey = 'size' | 'weight' | 'tracking' | 'leading';
  const TEXT_FIELDS: { key: TextKey; label: string; step: number }[] = [
    { key: 'size', label: 'Size', step: 0.005 },
    { key: 'weight', label: 'Weight', step: 100 },
    { key: 'tracking', label: 'Tracking', step: 0.01 },
    { key: 'leading', label: 'Leading', step: 0.05 }
  ];

  const entries = $derived(Object.entries(styleLibrary.styles));
  const colourOf = (style: Style) => (style.color ? resolveColor(style.color, tokens) : '#000000');

  function edit(name: string, style: Style, patch: Record<string, unknown>) {
    const next = styleSchema.safeParse({ ...style, ...patch });
    if (next.success) {
      styleLibrary.push(name, next.data);
    }
  }

  function numeric(name: string, style: Style, key: TextKey, raw: string) {
    edit(name, style, { [key]: raw === '' ? undefined : Number(raw) });
  }
</script>

{#if entries.length}
  <section class="library" data-testid="style-library">
    <header>Styles · canvas</header>
    {#each entries as [name, style] (name)}
      <div class="style" data-testid="style-library-row">
        <div class="row">
          <input type="color" data-testid={`style-library-colour-${name}`} value={colourOf(style)} onchange={(e) => edit(name, style, { color: e.currentTarget.value })} />
          <input class="name" type="text" value={name} aria-label="Style name" data-testid={`style-library-name-${name}`} onchange={(e) => styleLibrary.rename(name, e.currentTarget.value.trim())} />
        </div>
        {#if style.kind === StyleKind.Text}
          <div class="fields">
            <label class="field">
              <span>Font</span>
              <input type="text" value={style.font ?? ''} data-testid={`style-library-font-${name}`} onchange={(e) => edit(name, style, { font: e.currentTarget.value.trim() || undefined })} />
            </label>
            {#each TEXT_FIELDS as f (f.key)}
              <label class="field">
                <span>{f.label}</span>
                <input type="number" step={f.step} value={style[f.key] ?? ''} data-testid={`style-library-${f.key}-${name}`} onchange={(e) => numeric(name, style, f.key, e.currentTarget.value)} />
              </label>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </section>
{/if}

<style>
  .library {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3);
    padding: var(--ui-space-3) var(--ui-space-4);
    border-top: 1px solid var(--ui-line);
    font-size: var(--ui-type-caption);
  }

  header {
    font-weight: 600;
    color: var(--ui-text);
  }

  .style {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
  }

  .row {
    display: grid;
    grid-template-columns: 24px 1fr;
    align-items: center;
    gap: var(--ui-space-2);
  }

  input[type='color'] {
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-xs);
    background: transparent;
  }

  input[type='text'],
  input[type='number'] {
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    padding: 4px 6px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-surface);
    color: var(--ui-text);
    font: inherit;
  }

  .fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--ui-space-2);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: var(--ui-text-tertiary);
  }
</style>
