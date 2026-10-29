<script lang="ts">
  import Copy from '@lucide/svelte/icons/copy';
  import Check from '@lucide/svelte/icons/check';
  import Download from '@lucide/svelte/icons/download';
  import FileCode from '@lucide/svelte/icons/file-code-2';
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import type { BrandTokens } from '@feega/motion-core/motion/brand';
  import { CODE_TARGETS, CodeTarget, exportCode } from '@feega/motion-core/motion/codegen/index';
  import { kebab } from '@feega/motion-core/motion/codegen/naming';
  import { zipSync, strToU8 } from 'fflate';
  import { entryFile } from '$lib/components/motion/code-files';
  import { IconButton, SegmentedControl, IconSize } from '$lib/components/ui/shell';
  import CodeBlock from './CodeBlock.svelte';

  let { doc, name, assets, tokens }: { doc: MotionDoc; name: string; assets: Record<string, string>; tokens: BrandTokens } = $props();

  const COPIED_MS = 1200;
  const ZIP_MIME = 'application/zip';
  const SHORT_LABEL: Record<CodeTarget, string> = { [CodeTarget.React]: 'React', [CodeTarget.Html]: 'HTML', [CodeTarget.Svelte]: 'Svelte' };
  const OPTIONS = CODE_TARGETS.map((id) => ({ value: id, label: SHORT_LABEL[id] }));

  let target = $state<CodeTarget>(CodeTarget.React);
  let picked = $state('');
  let copied = $state(false);

  const out = $derived(exportCode(doc, { target, name, assets, brand: tokens }));
  const shown = $derived(entryFile(out.files, picked));
  const fileName = (path: string) => path.split('/').pop() ?? path;

  function pickTarget(id: string) {
    target = id as CodeTarget;
    picked = '';
  }

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
  <header>
    <strong title={name}>{name}</strong>
    <div class="actions">
      <IconButton label={copied ? 'Copied' : 'Copy file'} size={IconSize.Sm} data-testid="dev-code-copy-file" onclick={copy}>
        {#if copied}<Check />{:else}<Copy />{/if}
      </IconButton>
      <IconButton label="Download .zip" size={IconSize.Sm} data-testid="dev-code-download" onclick={download}><Download /></IconButton>
    </div>
  </header>

  <div class="targets" data-testid="dev-code-targets">
    <SegmentedControl label="Target" options={OPTIONS} value={target} onchange={pickTarget} />
  </div>

  {#if shown}
    {#if out.files.length > 1}
      <div class="files" role="tablist" aria-label="Files" data-testid="dev-code-files">
        {#each out.files as file (file.path)}
          <button type="button" role="tab" aria-selected={file.path === shown.path} class:on={file.path === shown.path} title={file.path} onclick={() => (picked = file.path)}>{fileName(file.path)}</button>
        {/each}
      </div>
    {/if}
    <CodeBlock code={shown.content} />
  {:else}
    <div class="empty" data-testid="dev-code-empty"><FileCode size={20} /><span>Nothing to export yet. Add a layer to the frame.</span></div>
  {/if}

  {#if out.notes.length}
    <p class="notes">Not exported: {out.notes.join(' ')}</p>
  {/if}
</section>

<style>
  .code { display: flex; flex-direction: column; gap: var(--ui-space-3); padding: var(--ui-space-4); min-width: 0; }
  header { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-2); min-width: 0; }
  strong { font-size: var(--ui-type-label); font-weight: var(--ui-weight-semibold); color: var(--ui-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .actions { display: flex; gap: var(--ui-space-1); flex-shrink: 0; }
  .targets { display: flex; }
  .targets :global([data-slot='segmented-control']) { flex: 1; }
  .files { display: flex; gap: var(--ui-space-1); overflow-x: auto; scrollbar-width: none; }
  .files button { flex-shrink: 0; font: inherit; font-family: var(--ui-mono); font-size: var(--ui-type-caption); padding: var(--ui-space-1) var(--ui-space-2); border: 0; border-radius: var(--ui-radius-sm); background: none; color: var(--ui-text-secondary); cursor: pointer; }
  .files button:hover { color: var(--ui-text); background: var(--ui-wash); }
  .files button.on { color: var(--ui-text); background: var(--ui-selected); }
  .empty { display: flex; flex-direction: column; align-items: center; gap: var(--ui-space-2); padding: var(--ui-space-6, 24px) var(--ui-space-3); border-radius: var(--ui-radius-md); background: var(--ui-panel-sunken); color: var(--ui-text-secondary); font-size: var(--ui-type-caption); text-align: center; }
  .notes { margin: 0; font-size: var(--ui-type-caption); color: var(--ui-text-secondary); }
</style>
