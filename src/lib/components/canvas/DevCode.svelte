<script lang="ts">
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import type { BrandTokens } from '@feega/motion-core/motion/brand';
  import { CODE_TARGETS, CodeTarget, TARGETS, exportCode } from '@feega/motion-core/motion/codegen/index';
  import { kebab } from '@feega/motion-core/motion/codegen/naming';
  import { zipSync, strToU8 } from 'fflate';
  import { entryFile } from '$lib/components/motion/code-files';

  let { doc, name, assets, tokens }: { doc: MotionDoc; name: string; assets: Record<string, string>; tokens: BrandTokens } = $props();

  const COPIED_MS = 1200;
  const ZIP_MIME = 'application/zip';

  let target = $state<CodeTarget>(CodeTarget.React);
  let copied = $state(false);

  const out = $derived(exportCode(doc, { target, name, assets, brand: tokens }));
  const shown = $derived(entryFile(out.files));

  async function copy() {
    if (!shown) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shown.content);
    } catch {
      return;
    }
    copied = true;
    setTimeout(() => (copied = false), COPIED_MS);
  }

  function download() {
    const folder = kebab(name);
    const zipped = zipSync(Object.fromEntries(out.files.map((f) => [`${folder}/${f.path}`, strToU8(f.content)])));
    const url = URL.createObjectURL(new Blob([zipped as BlobPart], { type: ZIP_MIME }));
    Object.assign(document.createElement('a'), { href: url, download: `${folder}-${target}.zip` }).click();
    URL.revokeObjectURL(url);
  }
</script>

<section class="code" data-testid="dev-code" aria-label="Frame code">
  <div class="targets" role="radiogroup" aria-label="Target">
    {#each CODE_TARGETS as id (id)}
      <button type="button" role="radio" aria-checked={target === id} class:on={target === id} data-testid="dev-code-target-{id}" onclick={() => (target = id)}>{TARGETS[id].stack}</button>
    {/each}
  </div>
  {#if shown}
    <div class="title"><span>{shown.path}</span><button type="button" onclick={copy} data-testid="dev-code-copy">{copied ? 'Copied' : 'Copy'}</button></div>
    <pre data-testid="dev-code-source">{shown.content}</pre>
  {/if}
  {#if out.notes.length}
    <p class="notes">Not exported: {out.notes.join(' ')}</p>
  {/if}
  <button type="button" class="open" onclick={download} data-testid="dev-code-download">Download .zip</button>
</section>

<style>
  .code { display: flex; flex-direction: column; gap: var(--ui-space-3); padding: var(--ui-space-4); min-width: 0; }
  .targets { display: flex; gap: var(--ui-space-1); padding: 2px; border-radius: var(--ui-radius-sm); background: var(--ui-panel-sunken); }
  .targets button { flex: 1; font: inherit; font-size: var(--ui-type-caption); padding: var(--ui-space-1) var(--ui-space-2); border: 0; border-radius: var(--ui-radius-sm); background: none; color: var(--ui-text-secondary); cursor: pointer; }
  .targets button.on { background: var(--ui-panel-raised); color: var(--ui-text); }
  .title { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-2); font-size: var(--ui-type-caption); color: var(--ui-text-secondary); }
  .title span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .title button, .open { font: inherit; font-size: var(--ui-type-caption); color: var(--ui-text); background: var(--ui-input); border: 0; border-radius: var(--ui-radius-sm); padding: var(--ui-space-1) var(--ui-space-3); cursor: pointer; }
  .title button:hover, .open:hover { background: var(--ui-input-hover); }
  .notes { margin: 0; font-size: var(--ui-type-caption); color: var(--ui-text-secondary); }
  pre { margin: 0; padding: var(--ui-space-3); max-height: 360px; overflow: auto; background: var(--ui-panel-sunken); border-radius: var(--ui-radius-sm); font-family: var(--ui-mono); font-size: var(--ui-type-caption); line-height: 1.5; color: var(--ui-text); user-select: text; }
</style>
