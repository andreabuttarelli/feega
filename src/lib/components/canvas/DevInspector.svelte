<script lang="ts">
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import type { BrandTokens } from '@feega/motion-core/motion/brand';
  import { cssText, devLayer, tailwindClasses, type DevToken } from '@feega/motion-core/motion/codegen/dev-css';

  let { doc, clipId, brand, onexport = null }: { doc: MotionDoc; clipId: string; brand: BrandTokens | null; onexport?: (() => void) | null } = $props();

  const COPIED_MS = 1200;

  const layer = $derived(devLayer(doc, clipId, brand));
  const css = $derived(layer ? cssText(layer) : '');
  const tailwind = $derived(layer ? tailwindClasses(layer) : '');
  const rows = $derived(layer ? ([['X', layer.box.left], ['Y', layer.box.top], ['W', layer.box.width], ['H', layer.box.height]] as const) : []);

  let copied = $state<string | null>(null);

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    copied = key;
    setTimeout(() => (copied = copied === key ? null : copied), COPIED_MS);
  }

  const tokenLabel = (token: DevToken) => (token.value ? `${token.name} · ${token.value}` : token.name);
</script>

{#if layer}
  <section class="dev" data-testid="dev-inspector" aria-label="Dev mode">
    <header>
      <strong>{layer.name}</strong>
      <span class="badge">read-only</span>
    </header>

    <dl class="measures" data-testid="dev-measures">
      {#each rows as [label, value] (label)}
        <div><dt>{label}</dt><dd>{Math.round(value * 100) / 100}</dd></div>
      {/each}
    </dl>

    <div class="block">
      <div class="title"><span>CSS</span><button type="button" onclick={() => copy('css', css)} data-testid="dev-copy-css">{copied === 'css' ? 'Copied' : 'Copy'}</button></div>
      <pre data-testid="dev-css">{css}</pre>
    </div>

    <div class="block">
      <div class="title"><span>Tailwind</span><button type="button" onclick={() => copy('tailwind', tailwind)} data-testid="dev-copy-tailwind">{copied === 'tailwind' ? 'Copied' : 'Copy'}</button></div>
      <pre data-testid="dev-tailwind">{tailwind}</pre>
    </div>

    {#if layer.tokens.length}
      <div class="block" data-testid="dev-tokens">
        <div class="title"><span>Variables</span></div>
        <ul>
          {#each layer.tokens as token (token.role + token.name)}
            <li>
              <button type="button" class="chip" title="Copy the name" onclick={() => copy(token.name, token.name)}>
                {#if token.role === 'colour' && token.value}<i style:background={token.value}></i>{/if}
                <span>{copied === token.name ? 'Copied' : tokenLabel(token)}</span>
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if onexport}
      <button type="button" class="export" onclick={onexport} data-testid="dev-export">Export layer</button>
    {/if}
  </section>
{/if}

<style>
  .dev { display: flex; flex-direction: column; gap: var(--ui-space-4); padding: var(--ui-space-4); }
  header { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-2); }
  strong { font-size: var(--ui-type-label); font-weight: var(--ui-weight-semibold); color: var(--ui-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .badge { font-size: var(--ui-type-caption); color: var(--ui-text-secondary); border: 1px solid var(--ui-line); border-radius: var(--ui-radius-full); padding: 0 var(--ui-space-2); }
  .measures { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--ui-space-2); margin: 0; }
  .measures div { display: flex; flex-direction: column; gap: 2px; padding: var(--ui-space-2); background: var(--ui-panel-sunken); border-radius: var(--ui-radius-sm); }
  dt { font-size: var(--ui-type-caption); color: var(--ui-text-secondary); }
  dd { margin: 0; font-family: var(--ui-mono); font-size: var(--ui-type-value); color: var(--ui-text); }
  .block { display: flex; flex-direction: column; gap: var(--ui-space-2); }
  .title { display: flex; align-items: center; justify-content: space-between; font-size: var(--ui-type-caption); color: var(--ui-text-secondary); }
  .title button, .export, .chip { font: inherit; font-size: var(--ui-type-caption); color: var(--ui-text); background: var(--ui-input); border: 0; border-radius: var(--ui-radius-sm); padding: var(--ui-space-1) var(--ui-space-3); cursor: pointer; }
  .title button:hover, .export:hover, .chip:hover { background: var(--ui-input-hover); }
  pre { margin: 0; padding: var(--ui-space-3); background: var(--ui-panel-sunken); border-radius: var(--ui-radius-sm); font-family: var(--ui-mono); font-size: var(--ui-type-caption); line-height: 1.5; color: var(--ui-text); white-space: pre-wrap; word-break: break-word; user-select: text; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--ui-space-2); }
  .chip { display: inline-flex; align-items: center; gap: var(--ui-space-2); }
  .chip i { width: 10px; height: 10px; border-radius: var(--ui-radius-xs); box-shadow: inset 0 0 0 1px var(--ui-line-strong); }
</style>
