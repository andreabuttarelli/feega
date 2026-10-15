<script lang="ts">
  import IconButton from './IconButton.svelte';
  import { Action } from '$lib/motion/actions';
  import { editorAction } from '$lib/frame-editor/client';
  import type { MotionDoc } from '$lib/motion/doc';
  import { IMAGE_FORMATS, IMAGE_SCALES, ImageFormat, ImageScale, attachmentUrl, stillExport } from '$lib/motion/still-model';

  type Made = { url: string; width: number; height: number };

  let { doc, editorUrl, fileName, saved, onclose }: { doc: MotionDoc; editorUrl: string; fileName: string; saved: boolean; onclose: () => void } = $props();

  let format = $state(ImageFormat.Png);
  let scale = $state(ImageScale.One);
  let working = $state(false);
  let error = $state('');
  let made = $state<Made | null>(null);
  const sizeOf = (s: ImageScale) => stillExport(format, s).size(doc);

  async function exportImage() {
    working = true;
    error = '';
    made = null;
    const form = new FormData();
    form.set('format', format);
    form.set('scale', String(scale));
    const result = await editorAction(editorUrl, 'still', form);
    working = false;
    if (result.type === 'success' && result.data) {
      made = result.data as Made;
      return;
    }
    error = result.type === 'failure' ? String(result.data?.error ?? 'Export failed') : 'Export failed';
  }
</script>

<div class="scrim" role="presentation" onclick={() => !working && onclose()}></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label="Export image" data-testid="still-export">
  <header>
    <span>Export image</span>
    <IconButton action={Action.Close} disabled={working} onclick={onclose} />
  </header>
  <label>
    Format
    <select bind:value={format} disabled={working}>
      {#each IMAGE_FORMATS as f (f)}<option value={f}>{f.toUpperCase()}</option>{/each}
    </select>
  </label>
  <label>
    Size
    <select bind:value={scale} disabled={working}>
      {#each IMAGE_SCALES as s (s)}<option value={s}>{s}x · {sizeOf(s).width}×{sizeOf(s).height}</option>{/each}
    </select>
  </label>
  {#if !saved}<p class="note">Saving… the image is drawn from the saved version.</p>{/if}
  {#if error}<p class="warn" role="alert">{error}</p>{/if}
  {#if made}
    <a class="primary" href={attachmentUrl(made.url, `${fileName}.${stillExport(format, scale).ext}`)} download={`${fileName}.${stillExport(format, scale).ext}`} data-testid="still-export-file">Download {made.width}×{made.height}</a>
  {/if}
  <button type="button" class="primary" disabled={working || !saved} onclick={exportImage} data-testid="still-export-go">{working ? 'Drawing…' : 'Export'}</button>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.35);
    z-index: 40;
  }

  .dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(360px, calc(100vw - 32px));
    z-index: 41;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    color: var(--ui-ink);
    font-size: 13px;
    border: 0;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
  }

  header {
    display: flex;
    justify-content: space-between;
    font-weight: 600;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    color: var(--ui-ink-2);
  }

  select {
    padding: 6px 8px;
    border: 1px solid var(--ui-line);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
  }

  .note,
  .warn {
    margin: 0;
  }

  .warn {
    color: #b45309;
  }

  .primary {
    padding: 8px 12px;
    background: var(--ui-accent-solid);
    color: var(--ui-accent-ink);
    font-size: 12px;
    text-align: center;
    text-decoration: none;
  }

  .primary:disabled {
    opacity: 0.5;
  }
</style>
