<script lang="ts">
  import { onMount } from 'svelte';
  import X from '@lucide/svelte/icons/x';
  import Download from '@lucide/svelte/icons/download';
  import type { MotionDoc } from '$lib/motion/doc';
  import { FORMATS, formatOf } from '$lib/motion/doc';
  import { Resolution } from '$lib/motion/render-quote';
  import { AudioMode, Support, eta, exportSize, exportSupport, frameTimes, type ExportScope, type ExportSupport, type Size } from '$lib/motion/export-plan';
  import { audioPlan } from '$lib/motion/audio-plan';
  import { capabilities, encodeMp4, mixAudio } from '$lib/motion/export/encode';
  import { saveExport } from '$lib/motion/export/save';
  import type { FrameSize } from './MotionPreview.svelte';

  type Renderer = (times: number[], size: FrameSize, onFrame: (bitmap: ImageBitmap, index: number) => Promise<void>, signal: AbortSignal) => Promise<void>;

  const Phase = { Checking: 'checking', Ready: 'ready', Mixing: 'mixing', Rendering: 'rendering', Saving: 'saving', Done: 'done', Failed: 'failed' } as const;
  type Phase = (typeof Phase)[keyof typeof Phase];

  const PROGRESS_LABEL: Partial<Record<Phase, string>> = {
    [Phase.Mixing]: 'Mixing audio…',
    [Phase.Rendering]: 'Rendering frames…',
    [Phase.Saving]: 'Saving to your assets…'
  };

  let {
    doc,
    assetUrls,
    scope,
    editorUrl,
    fileName,
    render,
    onclose
  }: {
    doc: MotionDoc;
    assetUrls: Record<string, string>;
    scope: ExportScope;
    editorUrl: string;
    fileName: string;
    render: Renderer;
    onclose: () => void;
  } = $props();

  let phase = $state<Phase>(Phase.Checking);
  let support = $state<ExportSupport>({ support: Support.None, audio: AudioMode.Off });
  let resolution = $state(Resolution.P1080);
  let withAudio = $state(true);
  let done = $state(0);
  let startedAt = $state(0);
  let now = $state(0);
  let error = $state('');
  let downloadUrl = $state('');
  let savedNote = $state('');
  let controller: AbortController | null = null;

  const total = $derived(doc.durationInFrames);
  const sounds = $derived(audioPlan(doc, assetUrls));
  const size = $derived<Size>(exportSize(doc, resolution));
  const remaining = $derived(eta({ done, total, elapsedMs: now - startedAt }));
  const busy = $derived(phase === Phase.Mixing || phase === Phase.Rendering || phase === Phase.Saving);
  const audioOn = $derived(withAudio && support.audio === AudioMode.On && sounds.length > 0);

  onMount(() => {
    void capabilities(doc).then((c) => {
      support = exportSupport(c);
      resolution = support.support === Support.Only720 ? Resolution.P720 : Resolution.P1080;
      phase = Phase.Ready;
    });
    return () => {
      controller?.abort();
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  });

  function etaLabel(seconds: number | null): string {
    if (seconds === null) {
      return 'estimating…';
    }
    return seconds < 60 ? `about ${seconds}s left` : `about ${Math.ceil(seconds / 60)} min left`;
  }

  async function start() {
    controller = new AbortController();
    const signal = controller.signal;
    error = '';
    done = 0;
    try {
      phase = Phase.Mixing;
      const audio = audioOn ? await mixAudio(sounds, doc.durationInFrames / doc.fps) : null;

      phase = Phase.Rendering;
      startedAt = performance.now();
      const times = frameTimes(doc);
      const blob = await encodeMp4({
        size,
        fps: doc.fps,
        frames: times.length,
        audio,
        signal,
        render: (onFrame) => render(times, size, onFrame, signal),
        onFrame: (n) => {
          done = n;
          now = performance.now();
        }
      });
      downloadUrl = URL.createObjectURL(blob);

      phase = Phase.Saving;
      const saved = await saveExport(blob, { scope, editorUrl, size, seconds: doc.durationInFrames / doc.fps });
      savedNote = saved.ok ? 'Saved to the canvas assets and attached to this video.' : `Not saved to your assets (${saved.error}). The download below still works.`;
      phase = Phase.Done;
    } catch (e) {
      if (signal.aborted) {
        phase = Phase.Ready;
        return;
      }
      error = e instanceof Error ? e.message : String(e);
      phase = Phase.Failed;
    }
  }

  function cancel() {
    controller?.abort();
  }
</script>

<div class="scrim" role="presentation" onclick={() => !busy && onclose()}></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label="Export video" data-testid="export-dialog">
  <header>
    <span>Export MP4</span>
    <button type="button" aria-label="Close" disabled={busy} onclick={onclose}><X size={16} /></button>
  </header>

  {#if phase === Phase.Checking}
    <p class="muted">Checking what this browser can encode…</p>
  {:else if support.support === Support.None}
    <p class="warn">This browser cannot encode video. Use a recent Chrome or Edge, or Safari 16.4 or later.</p>
  {:else}
    <dl>
      <dt>Format</dt>
      <dd>{FORMATS[formatOf(doc)].label} · {size.width}×{size.height} · 30 fps · {Math.round(doc.durationInFrames / doc.fps)} s</dd>
      <dt>Quality</dt>
      <dd class="choice">
        <label><input type="radio" name="res" value={Resolution.P1080} bind:group={resolution} disabled={busy || support.support === Support.Only720} /> 1080p</label>
        <label><input type="radio" name="res" value={Resolution.P720} bind:group={resolution} disabled={busy} /> 720p</label>
      </dd>
      <dt>Audio</dt>
      <dd>
        {#if !sounds.length}
          <span class="muted">No audio clips</span>
        {:else if support.audio === AudioMode.Unavailable}
          <span class="warn">This browser cannot encode AAC audio: the video exports silent. Chrome or Edge on macOS/Windows can.</span>
        {:else}
          <label><input type="checkbox" bind:checked={withAudio} disabled={busy} /> {sounds.length} {sounds.length === 1 ? 'track' : 'tracks'} mixed in</label>
        {/if}
      </dd>
      <dt>Cost</dt>
      <dd>Free — it renders in this tab. Keep it open until it finishes.</dd>
    </dl>

    {#if PROGRESS_LABEL[phase]}
      <div class="progress" data-testid="export-progress">
        <div class="track"><div class="fill" style={`width: ${(done / total) * 100}%`}></div></div>
        <span>{PROGRESS_LABEL[phase]} {#if phase === Phase.Rendering}{done}/{total} · {etaLabel(remaining)}{/if}</span>
      </div>
    {/if}

    {#if phase === Phase.Failed}<p class="warn" role="alert">Export failed: {error}</p>{/if}

    {#if phase === Phase.Done}
      <p class="muted" data-testid="export-saved">{savedNote}</p>
      <a class="primary" href={downloadUrl} download={`${fileName}.mp4`} data-testid="export-download"><Download size={14} /> Download MP4</a>
    {:else if busy}
      <button type="button" class="secondary" disabled={phase === Phase.Saving} onclick={cancel}>Cancel</button>
    {:else}
      <button type="button" class="primary" onclick={start} data-testid="export-start">Export {resolution}</button>
    {/if}
  {/if}
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
    width: min(440px, calc(100vw - 32px));
    z-index: 41;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--paper);
    color: var(--ink);
    border: 1px solid var(--line);
    box-shadow: 0 16px 48px rgb(0 0 0 / 0.2);
    font-size: 13px;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
  }

  dl {
    display: grid;
    grid-template-columns: 70px 1fr;
    gap: 8px 12px;
    margin: 0;
  }

  dt {
    color: var(--ink-soft);
  }

  dd {
    margin: 0;
  }

  .choice {
    display: flex;
    gap: 14px;
  }

  label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .muted {
    color: var(--ink-soft);
    margin: 0;
  }

  .warn {
    color: #b45309;
    margin: 0;
  }

  .progress {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-family: 'Fragment Mono', ui-monospace, monospace;
    font-size: 11px;
  }

  .track {
    height: 4px;
    background: var(--paper-3);
  }

  .fill {
    height: 100%;
    background: var(--ink);
    transition: width 120ms linear;
  }

  .primary,
  .secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    font-size: 12px;
  }

  .primary {
    background: var(--ink);
    color: var(--paper);
  }

  .secondary {
    border: 1px solid var(--line);
  }
</style>
