<script lang="ts">
  import { onDestroy } from 'svelte';
  import { MicMode, startRecording, type RecordingRun } from '$lib/canvas/area-recorder';
  import { RECORD_MAX_SECONDS, RecordPhase as Phase, clockLabel, type Area } from '$lib/canvas/screen-recording';

  let { source, areaOf, onsaved }: { source: () => HTMLCanvasElement | null; areaOf: () => Area; onsaved: (file: File) => void } = $props();

  let phase = $state(Phase.Idle);
  let mic = $state(MicMode.Off);
  let seconds = $state(0);
  let problem = $state<string | null>(null);
  let download = $state<{ url: string; name: string } | null>(null);
  let run: RecordingRun | null = null;

  async function begin() {
    const canvas = source();
    if (!canvas) {
      problem = 'Nothing to record yet.';
      return;
    }

    problem = null;
    try {
      run = await startRecording({ source: canvas, area: areaOf(), mic, onTick: (s) => (seconds = s) });
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
      return;
    }

    seconds = 0;
    phase = Phase.Recording;
    const file = await run.done;
    run = null;
    if (download) {
      URL.revokeObjectURL(download.url);
    }
    download = { url: URL.createObjectURL(file), name: file.name };
    phase = Phase.Saved;
    onsaved(file);
  }

  onDestroy(() => {
    run?.stop();
    if (download) {
      URL.revokeObjectURL(download.url);
    }
  });
</script>

<div class="record" data-testid="record-control" data-phase={phase}>
  {#if phase === Phase.Recording}
    <span class="dot" aria-hidden="true"></span>
    <span data-testid="record-clock">{clockLabel(seconds)} / {clockLabel(RECORD_MAX_SECONDS)}</span>
    <button type="button" data-testid="record-stop" onclick={() => run?.stop()}>Stop</button>
  {:else}
    <label class="mic"><input type="checkbox" data-testid="record-mic" checked={mic === MicMode.On} onchange={(e) => (mic = e.currentTarget.checked ? MicMode.On : MicMode.Off)} />Mic</label>
    <button type="button" data-testid="record-start" onclick={begin}>Record</button>
    {#if phase === Phase.Saved && download}
      <a data-testid="record-download" href={download.url} download={download.name}>Download</a>
    {/if}
  {/if}
  {#if problem}<span class="problem" data-testid="record-problem">{problem}</span>{/if}
</div>

<style>
  .record {
    position: absolute;
    right: 16px;
    bottom: 64px;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: var(--ui-radius-lg, 10px);
    background: var(--ui-bg, #fff);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.18);
    font-size: 12px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 9999px;
    background: #e5484d;
  }

  .mic {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  button {
    border-radius: var(--ui-radius-sm, 4px);
    padding: 2px 8px;
    background: var(--ui-bg-muted, #f2f2f2);
  }

  .problem {
    color: #c0392b;
  }
</style>
