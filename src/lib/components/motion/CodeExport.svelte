<script lang="ts">
  import { onMount } from 'svelte';
  import { zipSync, strToU8 } from 'fflate';
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import type { BrandTokens } from '@feega/motion-core/motion/brand';
  import { CODE_TARGETS, CodeTarget, TARGETS, exportCode } from '@feega/motion-core/motion/codegen/index';
  import { kebab } from '@feega/motion-core/motion/codegen/naming';
  import { CodeLanguage, type CodeView } from './code-editor';
  import { entryFile } from './code-files';

  let { doc, name, assets, tokens }: { doc: MotionDoc; name: string; assets: Record<string, string>; tokens: BrandTokens } = $props();

  const LANGUAGE_OF: Record<string, CodeLanguage> = { tsx: CodeLanguage.Tsx, ts: CodeLanguage.Js, js: CodeLanguage.Js, svelte: CodeLanguage.Svelte, html: CodeLanguage.Html, css: CodeLanguage.Css, json: CodeLanguage.Json };
  const COPIED_MS = 1500;
  const ZIP_MIME = 'application/zip';

  let target = $state<CodeTarget>(CodeTarget.React);
  let picked = $state('');
  let copied = $state(false);
  let host = $state<HTMLDivElement | null>(null);
  let view = $state<CodeView | null>(null);

  const out = $derived(exportCode(doc, { target, name, assets, brand: tokens }));
  const shown = $derived(entryFile(out.files, picked));
  const languageOf = (path: string) => LANGUAGE_OF[path.split('.').at(-1) ?? ''] ?? CodeLanguage.Js;

  onMount(() => {
    let disposed = false;
    void import('./code-editor').then(({ mountCode }) => {
      if (disposed || !host) {
        return;
      }
      view = mountCode(host, () => {});
    });
    return () => {
      disposed = true;
      view?.destroy();
    };
  });

  $effect(() => {
    if (view && shown) {
      view.show(shown.content, languageOf(shown.path), null);
    }
  });

  async function copy() {
    if (!shown) {
      return;
    }
    await navigator.clipboard.writeText(shown.content);
    copied = true;
    setTimeout(() => (copied = false), COPIED_MS);
  }

  function download() {
    const folder = kebab(name);
    const zipped = zipSync(Object.fromEntries(out.files.map((f) => [`${folder}/${f.path}`, strToU8(f.content)])));
    const url = URL.createObjectURL(new Blob([zipped as BlobPart], { type: ZIP_MIME }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `${folder}-${target}.zip` });
    link.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="code-export" data-testid="code-export">
  <div class="targets" role="radiogroup" aria-label="Target">
    {#each CODE_TARGETS as id (id)}
      <button type="button" role="radio" aria-checked={target === id} class:on={target === id} data-testid="code-target-{id}" onclick={() => (target = id)}>{TARGETS[id].stack}</button>
    {/each}
  </div>
  <div class="panes">
    <ul class="files" aria-label="Files">
      {#each out.files as file (file.path)}
        <li>
          <button type="button" class:on={file.path === shown?.path} data-testid="code-file" onclick={() => (picked = file.path)}>{file.path}</button>
        </li>
      {/each}
    </ul>
    <div class="preview" bind:this={host}></div>
  </div>
  {#if out.notes.length}
    <p class="notes">Not exported: {out.notes.join(' ')}</p>
  {/if}
  <div class="actions">
    <button type="button" data-testid="code-copy" onclick={copy}>{copied ? 'Copied' : 'Copy file'}</button>
    <button type="button" class="primary" data-testid="code-download" onclick={download}>Download .zip</button>
  </div>
</div>

<style>
  .code-export {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
  }

  .targets {
    display: flex;
    gap: 4px;
    padding: 2px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-panel-sunken);
  }

  .targets button {
    flex: 1;
    padding: 6px 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-secondary);
    font: inherit;
    cursor: pointer;
  }

  .targets button.on {
    background: var(--ui-panel-raised);
    color: var(--ui-ink);
    box-shadow: var(--ui-shadow-float);
  }

  .panes {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 8px;
    height: min(520px, calc(100vh - 260px));
  }

  .files {
    margin: 0;
    padding: 0;
    list-style: none;
    overflow: auto;
  }

  .files button {
    width: 100%;
    padding: 5px 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: inherit;
    font: 12px/1.4 var(--ui-mono);
    text-align: left;
    cursor: pointer;
    overflow-wrap: anywhere;
  }

  .files button.on {
    background: var(--ui-panel);
  }

  .preview {
    min-width: 0;
    overflow: hidden;
    border-radius: var(--ui-radius-sm);
    border: 1px solid var(--ui-line);
  }

  .notes {
    margin: 0;
    font-size: 12px;
    opacity: 0.7;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .actions button {
    padding: 7px 12px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .actions .primary {
    border-color: transparent;
    background: var(--ui-accent-solid);
    color: var(--ui-on-accent);
  }
</style>
