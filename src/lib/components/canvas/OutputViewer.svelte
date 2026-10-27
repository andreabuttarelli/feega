<script lang="ts">
  import CompareSlider from './CompareSlider.svelte';
  import { copyableParams, OutputKind, runInfoOf, type ViewerRun } from '$lib/canvas/run-info';

  const STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
  const COPIED_MS = 1500;

  let { runs, start, kind, urlFor, onclose }: { runs: readonly ViewerRun[]; start: number; kind: OutputKind; urlFor: (assetId: string) => string; onclose: () => void } = $props();

  let index = $state(start);
  let copied = $state(false);
  const run = $derived(runs[index]);
  const info = $derived(run ? runInfoOf(run) : null);
  const url = $derived(run?.outputAssetId ? urlFor(run.outputAssetId) : null);

  let comparing = $state(false);
  const before = $derived(kind === OutputKind.Image && index > 0 && runs[index - 1]?.outputAssetId ? runs[index - 1] : null);

  function step(by: number) {
    index = Math.min(Math.max(index + by, 0), runs.length - 1);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onclose();
      return;
    }
    const by = STEPS[e.key];
    if (by && !comparing) {
      e.preventDefault();
      e.stopPropagation();
      step(by);
    }
  }

  async function copy() {
    if (!run) {
      return;
    }
    await navigator.clipboard.writeText(copyableParams(run));
    copied = true;
    setTimeout(() => (copied = false), COPIED_MS);
  }
</script>

<svelte:window onkeydowncapture={onKey} />

{#if run && info && url}
  <div class="viewer" role="dialog" aria-label="Output viewer" data-testid="output-viewer">
    <div class="stage">
      {#if comparing && before}
        <CompareSlider left={urlFor(before.outputAssetId!)} right={url} leftLabel="Previous" rightLabel="This" />
      {:else if kind === OutputKind.Video}
        <video src={url} controls autoplay loop playsinline></video>
      {:else if kind === OutputKind.Audio}
        <audio src={url} controls></audio>
      {:else}
        <img draggable="false" src={url} alt={info.prompt} />
      {/if}
    </div>
    <aside class="info" data-testid="output-info">
      <button type="button" class="close" aria-label="Close" onclick={onclose}>Close</button>
      <dl>
        <dt>Prompt</dt>
        <dd data-testid="info-prompt">{info.prompt || '—'}</dd>
        <dt>Model</dt>
        <dd data-testid="info-model">{info.model ?? '—'}</dd>
        <dt>Seed</dt>
        <dd data-testid="info-seed">{info.seed ?? '—'}</dd>
        <dt>Cost</dt>
        <dd data-testid="info-cost">{info.cost ?? '—'}</dd>
      </dl>
      <button type="button" onclick={copy} data-testid="copy-params">{copied ? 'Copied' : 'Copy params'}</button>
      {#if before}
        <button type="button" onclick={() => (comparing = !comparing)} aria-pressed={comparing} data-testid="compare-previous">{comparing ? 'Stop comparing' : 'Compare with previous'}</button>
      {/if}
      {#if runs.length > 1}
        <div class="steps">
          <button type="button" aria-label="Previous output" disabled={index === 0} onclick={() => step(-1)}>Prev</button>
          <span>{index + 1} / {runs.length}</span>
          <button type="button" aria-label="Next output" disabled={index === runs.length - 1} onclick={() => step(1)}>Next</button>
        </div>
      {/if}
    </aside>
  </div>
{/if}

<style>
  .viewer {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    background: rgb(0 0 0 / 0.92);
    color: #fff;
    font-family: var(--sans);
  }

  .stage {
    flex: 1;
    min-width: 0;
    display: grid;
    place-items: center;
    padding: 24px;
  }

  img,
  video {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .info {
    width: 300px;
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-left: 1px solid rgb(255 255 255 / 0.15);
    overflow-y: auto;
    font-size: var(--ui-text-xs);
  }

  dt {
    color: rgb(255 255 255 / 0.55);
    margin-top: 10px;
  }

  dd {
    margin: 2px 0 0;
    word-break: break-word;
  }

  button {
    height: 28px;
    padding: 0 10px;
    border: 1px solid rgb(255 255 255 / 0.3);
    border-radius: var(--ui-radius-sm);
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .close {
    align-self: flex-end;
  }

  .steps {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  @media (max-width: 767px) {
    .viewer {
      flex-direction: column;
    }

    .info {
      width: auto;
      border-left: 0;
      border-top: 1px solid rgb(255 255 255 / 0.15);
      max-height: 45vh;
    }
  }
</style>
