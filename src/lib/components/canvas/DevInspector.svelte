<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import type { BrandTokens } from '@feega/motion-core/motion/brand';
  import { cssText, devLayer, tailwindClasses, TokenRole } from '@feega/motion-core/motion/codegen/dev-css';
  import { groupDeclarations } from './dev-groups';
  import CodeBlock from './CodeBlock.svelte';

  let { doc, clipId, brand, onexport = null }: { doc: MotionDoc; clipId: string; brand: BrandTokens | null; onexport?: (() => void) | null } = $props();

  const COPIED_MS = 1200;
  const round = (n: number) => Math.round(n * 100) / 100;

  const layer = $derived(devLayer(doc, clipId, brand));
  const css = $derived(layer ? cssText(layer) : '');
  const tailwind = $derived(layer ? tailwindClasses(layer) : '');
  const rows = $derived(layer ? ([['X', layer.box.left], ['Y', layer.box.top], ['W', layer.box.width], ['H', layer.box.height]] as const) : []);
  const groups = $derived(layer ? groupDeclarations(layer.declarations) : []);

  let copied = $state<string | null>(null);
  let snippets = $state(false);

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    copied = key;
    setTimeout(() => (copied = copied === key ? null : copied), COPIED_MS);
  }
</script>

{#if layer}
  <details class="dev" open data-testid="dev-inspector" aria-label="Coder mode">
    <summary>
      <strong>{layer.name}</strong>
      <span class="kind">{layer.component}</span>
      <ChevronDown size={14} />
    </summary>

    <dl class="measures" data-testid="dev-measures">
      {#each rows as [label, value] (label)}
        <button type="button" class="cell" title="Copy {label}" onclick={() => copy(label, String(round(value)))}>
          <dt>{label}</dt><dd>{copied === label ? 'Copied' : round(value)}</dd>
        </button>
      {/each}
    </dl>

    {#each groups as [group, items] (group)}
      <div class="group">
        <h4>{group}</h4>
        {#each items as item (item.property)}
          <button type="button" class="row" title="Copy value" onclick={() => copy(item.property, item.value)}>
            <span class="label">{item.property}</span>
            <span class="value">
              {#if item.swatch}<i style:background={item.value}></i>{/if}
              <span>{copied === item.property ? 'Copied' : item.value}</span>
            </span>
          </button>
        {/each}
      </div>
    {/each}

    {#if layer.tokens.length}
      <div class="group" data-testid="dev-tokens">
        <h4>Variables</h4>
        {#each layer.tokens as token (token.role + token.name)}
          <button type="button" class="row" title="Copy the name" onclick={() => copy(token.name, token.name)}>
            <span class="label">{copied === token.name ? 'Copied' : token.name}</span>
            <span class="value">
              {#if token.role === TokenRole.Colour && token.value}<i style:background={token.value}></i>{/if}
              <span>{token.value ?? ''}</span>
            </span>
          </button>
        {/each}
      </div>
    {/if}

    <button type="button" class="toggle" aria-expanded={snippets} onclick={() => (snippets = !snippets)} data-testid="dev-snippets-toggle">
      <span>CSS</span><ChevronDown size={14} class={snippets ? 'open' : ''} />
    </button>
    {#if snippets}
      <CodeBlock code={css} label="Copy CSS" testid="dev-css" copytestid="dev-copy-css" />
      <CodeBlock code={tailwind} label="Copy Tailwind" testid="dev-tailwind" copytestid="dev-copy-tailwind" />
    {/if}

    {#if onexport}
      <button type="button" class="export" onclick={onexport} data-testid="dev-export">Export layer</button>
    {/if}
  </details>
{/if}

<style>
  .dev { display: flex; flex-direction: column; gap: var(--ui-space-3); padding: var(--ui-space-4); border-bottom: 1px solid var(--ui-divider); }
  summary { display: flex; align-items: center; gap: var(--ui-space-2); cursor: pointer; list-style: none; color: var(--ui-text-secondary); }
  summary::-webkit-details-marker { display: none; }
  .dev[open] summary :global(svg) { transform: rotate(180deg); }
  strong { font-size: var(--ui-type-label); font-weight: var(--ui-weight-semibold); color: var(--ui-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kind { margin-right: auto; font-size: var(--ui-type-caption); color: var(--ui-text-tertiary); }
  .measures { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--ui-space-1); margin: 0; align-items: start; }
  .cell { height: auto; min-height: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: var(--ui-space-2); border: 0; font: inherit; background: var(--ui-panel-sunken); border-radius: var(--ui-radius-sm); cursor: pointer; text-align: left; }
  .cell:hover { background: var(--ui-input-hover); }
  dt { font-size: var(--ui-type-caption); color: var(--ui-text-tertiary); }
  dd { margin: 0; min-height: 0; font-family: var(--ui-mono); font-size: var(--ui-type-value); color: var(--ui-text); }
  .group { display: flex; flex-direction: column; }
  h4 { margin: 0 0 var(--ui-space-1); font-size: var(--ui-type-caption); font-weight: var(--ui-weight-semibold); color: var(--ui-text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-3); min-height: 26px; padding: 0 var(--ui-space-2); margin: 0 calc(-1 * var(--ui-space-2)); border: 0; border-radius: var(--ui-radius-sm); background: none; font: inherit; font-size: var(--ui-type-caption); cursor: pointer; text-align: left; }
  .row:hover { background: var(--ui-wash); }
  .label { color: var(--ui-text-secondary); flex-shrink: 0; }
  .value { display: inline-flex; align-items: center; gap: var(--ui-space-2); min-width: 0; font-family: var(--ui-mono); color: var(--ui-text); }
  .value span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  i { width: 12px; height: 12px; flex-shrink: 0; border-radius: var(--ui-radius-xs); box-shadow: inset 0 0 0 1px var(--ui-divider-strong); }
  .toggle, .export { width: 100%; display: flex; align-items: center; justify-content: space-between; font: inherit; font-size: var(--ui-type-caption); color: var(--ui-text); background: var(--ui-input); border: 0; border-radius: var(--ui-radius-sm); padding: var(--ui-space-2) var(--ui-space-3); cursor: pointer; }
  .toggle:hover, .export:hover { background: var(--ui-input-hover); }
  .toggle :global(.open) { transform: rotate(180deg); }
</style>
