<script lang="ts">
  import Copy from '@lucide/svelte/icons/copy';
  import Check from '@lucide/svelte/icons/check';
  import { highlight } from './highlight';

  let { code, label = 'Copy', testid = 'dev-code-source', copytestid = 'dev-code-copy' }: { code: string; label?: string; testid?: string; copytestid?: string } = $props();

  const COPIED_MS = 1200;

  const lines = $derived(highlight(code));

  let copied = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      return;
    }
    copied = true;
    setTimeout(() => (copied = false), COPIED_MS);
  }
</script>

<div class="block">
  <button type="button" class="copy" aria-label={copied ? 'Copied' : label} title={copied ? 'Copied' : label} data-testid={copytestid} onclick={copy}>
    {#if copied}<Check size={12} /><span>Copied</span>{:else}<Copy size={12} />{/if}
  </button>
  <pre data-testid={testid}><code>{#each lines as line, i (i)}<span class="line"><span class="no">{i + 1}</span><span class="src">{#each line as token, j (j)}<span class="tok-{token.kind}">{token.text}</span>{/each}</span></span>{/each}</code></pre>
</div>

<style>
  .block { position: relative; min-width: 0; }
  pre { margin: 0; padding: var(--ui-space-3) var(--ui-space-3) var(--ui-space-3) 0; max-height: 360px; overflow: auto; background: var(--ui-panel-sunken); border-radius: var(--ui-radius-md); box-shadow: inset 0 0 0 1px var(--ui-divider); font-family: var(--ui-mono); font-size: 11.5px; line-height: 1.65; color: var(--ui-text); user-select: text; tab-size: 2; }
  code { display: block; width: max-content; min-width: 100%; font: inherit; }
  .line { display: block; white-space: pre; }
  .no { display: inline-block; width: 3.2ch; margin-right: var(--ui-space-3); text-align: right; color: var(--ui-text-tertiary); opacity: 0.6; user-select: none; }
  .tok-comment { color: var(--ui-syntax-comment); font-style: italic; }
  .tok-string { color: var(--ui-syntax-string); }
  .tok-tag { color: var(--ui-syntax-tag); }
  .tok-number { color: var(--ui-syntax-number); }
  .tok-keyword { color: var(--ui-syntax-keyword); }
  .tok-property { color: var(--ui-syntax-property); }
  .copy { position: absolute; top: var(--ui-space-2); right: var(--ui-space-2); z-index: 1; display: inline-flex; align-items: center; gap: var(--ui-space-1); height: 24px; padding: 0 var(--ui-space-2); border: 0; border-radius: var(--ui-radius-sm); background: var(--ui-panel-raised); box-shadow: 0 0 0 1px var(--ui-divider); color: var(--ui-text-secondary); font: inherit; font-size: var(--ui-type-caption); cursor: pointer; }
  .copy:hover { color: var(--ui-text); background: var(--ui-wash); }
</style>
