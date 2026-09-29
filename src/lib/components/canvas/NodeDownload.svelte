<script lang="ts">
  /**
   * IL BOTTONE PER SCARICARE UN RISULTATO — immagine, video, Effetti, Composizione: quattro
   * tipi di nodo, un componente solo, perché "scarica quel che è uscito in un formato a scelta"
   * è la stessa azione ovunque, cambia solo la lista dei formati (`download.ts`).
   *
   * La conversione vera (canvas 2D per le immagini, gifenc per il GIF) sta in un modulo caricato
   * SOLO al primo download: nessuno paga quel peso per aprire una tela.
   */
  import DownloadIcon from '@lucide/svelte/icons/download';
  import LoaderIcon from '@lucide/svelte/icons/loader-circle';
  import XIcon from '@lucide/svelte/icons/x';
  import { formatsFor, buildDownloadFilename, clampGifPlan, MediaOrigin, type DownloadFormat, type MediaKind } from '$lib/canvas/download';
  import { avifEncodable } from '$lib/canvas/avif-support';

  let {
    kind,
    sourceUrl,
    nodeId,
    nodeType,
    displayName = null,
    origin = MediaOrigin.Other
  }: {
    kind: MediaKind;
    sourceUrl: string;
    nodeId: string;
    nodeType: string;
    displayName?: string | null;
    origin?: MediaOrigin;
  } = $props();

  let open = $state(false);
  let avifOk = $state(true);
  let busy = $state(false);
  let progress = $state(0);
  let cancelRequested = false;

  $effect(() => {
    if (kind === 'image') {
      void avifEncodable().then((ok) => (avifOk = ok));
    }
  });

  const formats = $derived(formatsFor(kind, { avifEncodable: avifOk }));

  function triggerDownload(blob: Blob, extension: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildDownloadFilename({ displayName, nodeId, nodeType, extension, origin });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadOriginal(extension: string) {
    const res = await fetch(sourceUrl);
    const blob = await res.blob();
    triggerDownload(blob, extension || guessExtension(blob.type));
  }

  function guessExtension(mime: string): string {
    return mime.split('/')[1] ?? 'bin';
  }

  async function downloadAs(format: DownloadFormat) {
    open = false;

    if (format.id === 'original' || format.id === 'mp4') {
      await downloadOriginal(format.extension);
      return;
    }

    busy = true;
    progress = 0;
    cancelRequested = false;

    try {
      if (kind === 'image') {
        const { convertImageTo } = await import('$lib/canvas/download-convert');
        const blob = await convertImageTo(sourceUrl, format.mime);
        triggerDownload(blob, format.extension);
        return;
      }

      if (format.id === 'gif') {
        const { convertVideoToGif } = await import('$lib/canvas/download-convert');
        const source = await probeVideo(sourceUrl);
        const plan = clampGifPlan(source);
        const blob = await convertVideoToGif(
          sourceUrl,
          plan,
          (fraction) => (progress = fraction),
          () => cancelRequested
        );
        triggerDownload(blob, format.extension);
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        throw err;
      }
    } finally {
      busy = false;
    }
  }

  function probeVideo(url: string): Promise<{ width: number; height: number; durationS: number; fps: number }> {
    const PROBE_FPS = 12;
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.preload = 'metadata';
      video.onloadedmetadata = () =>
        resolve({ width: video.videoWidth, height: video.videoHeight, durationS: video.duration, fps: PROBE_FPS });
      video.onerror = () => reject(new Error('video could not be read'));
      video.src = url;
    });
  }

  function cancel() {
    cancelRequested = true;
  }
</script>

<div class="node-download nodrag">
  {#if busy}
    <div class="node-download-progress" role="status">
      <LoaderIcon size={14} strokeWidth={2} class="node-download-spin" />
      <span>{Math.round(progress * 100)}%</span>
      <button type="button" class="node-download-cancel" onclick={cancel} aria-label="Cancel">
        <XIcon size={12} strokeWidth={2} />
      </button>
    </div>
  {:else}
    <button
      type="button"
      class="node-download-trigger"
      aria-label="Download"
      aria-expanded={open}
      onclick={() => (open = !open)}
    >
      <DownloadIcon size={14} strokeWidth={1.75} />
    </button>
    {#if open}
      <div class="node-download-menu" role="menu">
        {#each formats as format (format.id)}
          <button type="button" role="menuitem" onclick={() => downloadAs(format)}>
            {format.label}
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .node-download {
    position: relative;
    display: inline-flex;
  }

  .node-download-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 1px solid var(--line, #e5e5e5);
    background: var(--paper, #fff);
    color: var(--ink, #1d1d1f);
    cursor: pointer;
  }
  .node-download-trigger:hover {
    background: var(--paper-2, #f9f9f9);
  }

  .node-download-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    min-width: 110px;
    border: 1px solid var(--line, #e5e5e5);
    background: var(--paper, #fff);
    box-shadow: 0 8px 24px -12px rgb(0 0 0 / 0.3);
  }
  .node-download-menu button {
    padding: 6px 10px;
    font: inherit;
    font-size: 11.5px;
    text-align: left;
    border: none;
    background: transparent;
    color: var(--ink, #1d1d1f);
    cursor: pointer;
  }
  .node-download-menu button:hover {
    background: var(--paper-2, #f9f9f9);
  }

  .node-download-progress {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    font-size: 10.5px;
    border: 1px solid var(--line, #e5e5e5);
    background: var(--paper, #fff);
    color: var(--ink-soft, #6e6e73);
  }
  .node-download-cancel {
    display: flex;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--ink-soft, #6e6e73);
    cursor: pointer;
  }

  :global(.node-download-spin) {
    animation: node-download-spin 0.9s linear infinite;
  }
  @keyframes node-download-spin {
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.node-download-spin) { animation: none; }
  }
</style>
