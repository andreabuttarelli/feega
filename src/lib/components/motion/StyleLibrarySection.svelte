<script lang="ts">
  import ColorField from './ColorField.svelte';
  import { ColourDisplay } from '$lib/motion/colour-field';
  import { styleLibrary } from '$lib/canvas/style-library.svelte';
  import { STYLE_NAME, StyleKind, styleSchema, type Style } from '@feega/motion-core/motion/styles-model';
  import { styleLabel } from '$lib/motion/style-library';
  import { swatchOf } from '$lib/motion/fill/swatch';
  import { resolveColor, type BrandTokens } from '@feega/motion-core/motion/brand';

  let { tokens }: { tokens: BrandTokens } = $props();

  type TextKey = 'size' | 'weight' | 'tracking' | 'leading';
  const TEXT_FIELDS: { key: TextKey; label: string; step: number }[] = [
    { key: 'size', label: 'Size', step: 0.005 },
    { key: 'weight', label: 'Weight', step: 100 },
    { key: 'tracking', label: 'Tracking', step: 0.01 },
    { key: 'leading', label: 'Leading', step: 0.05 }
  ];

  const entries = $derived(Object.entries(styleLibrary.styles));
  const color = (value: string) => resolveColor(value, tokens);
  const colourOf = (style: Style) => ('color' in style && style.color ? color(style.color) : '#000000');
  const swatch = (style: Style) => (style.kind === StyleKind.Paint ? swatchOf(style.fills[0], { color, picture: (f) => f.src }) : null);

  function edit(name: string, style: Style, patch: Record<string, unknown>) {
    const next = styleSchema.safeParse({ ...style, ...patch });
    if (next.success) {
      void styleLibrary.push(name, next.data);
    }
  }

  const NEW_STYLES: { kind: StyleKind; label: string; style: Style }[] = [
    { kind: StyleKind.Text, label: 'Text', style: { kind: StyleKind.Text, size: 0.08, weight: 600 } },
    { kind: StyleKind.Colour, label: 'Colour', style: { kind: StyleKind.Colour, color: '#111111' } }
  ];

  let draft = $state('');

  function create(style: Style) {
    const name = draft.trim();
    if (!STYLE_NAME.test(name) || styleLibrary.styles[name]) {
      return;
    }
    void styleLibrary.push(name, style);
    draft = '';
  }

  function numeric(name: string, style: Style, key: TextKey, raw: string) {
    edit(name, style, { [key]: raw === '' ? undefined : Number(raw) });
  }
</script>

<section class="library" data-testid="style-library">
    <header>Styles · project</header>
    <div class="create">
      <input type="text" placeholder="New style name" bind:value={draft} aria-label="New style name" data-testid="style-library-new-name" onkeydown={(e) => e.stopPropagation()} />
      {#each NEW_STYLES as n (n.kind)}
        <button type="button" data-testid={`style-library-new-${n.kind}`} onclick={() => create(n.style)}>+ {n.label}</button>
      {/each}
    </div>
    {#if styleLibrary.failed}<p class="kind" data-testid="style-library-failed">A style change could not be saved and was undone.</p>{/if}
    {#each entries as [name, style] (name)}
      <div class="style" data-testid="style-library-row" data-kind={style.kind}>
        <div class="row">
          {#if style.kind === StyleKind.Text || style.kind === StyleKind.Colour}
            <span data-testid={`style-library-colour-${name}`}><ColorField {name} display={ColourDisplay.Chip} value={colourOf(style)} {tokens} onchange={(v) => edit(name, style, { color: v })} /></span>
          {:else}
            <span class="swatch" data-testid={`style-library-swatch-${name}`} style={`background:${swatch(style) ?? 'var(--ui-input)'}`}></span>
          {/if}
          <input class="name" type="text" value={name} aria-label="Style name" data-testid={`style-library-name-${name}`} onchange={(e) => void styleLibrary.rename(name, e.currentTarget.value.trim())} />
          <button type="button" class="remove" aria-label={`Delete ${name}`} data-testid={`style-library-remove-${name}`} onclick={() => void styleLibrary.remove(name)}>×</button>
        </div>
        <span class="kind">{styleLabel(style)}</span>
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
    grid-template-columns: 24px 1fr 20px;
    align-items: center;
    gap: var(--ui-space-2);
  }


  .swatch {
    width: 24px;
    height: 24px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-xs);
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

  .create {
    display: flex;
    gap: var(--ui-space-2);
  }

  button {
    padding: 4px 6px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-surface);
    color: var(--ui-text);
    font: inherit;
    white-space: nowrap;
  }

  .remove {
    padding: 0;
    border: 0;
    background: none;
    color: var(--ui-text-tertiary);
  }

  .kind {
    color: var(--ui-text-tertiary);
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
