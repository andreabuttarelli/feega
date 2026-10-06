<script lang="ts">
  import { onDestroy } from 'svelte';
  import { MIC_PROBLEM_MESSAGE, micProblemOf, recorderMime, recordingReady } from '$lib/canvas/voice-recording';
  import { CLONE_MAX_SECONDS, CLONE_MIN_SECONDS, CLONE_SCRIPT } from '$lib/canvas/voices';

  let { onrecorded }: { onrecorded: (take: { file: File; seconds: number } | null) => void } = $props();

  const TICK_MS = 250;
  const MS_PER_SECOND = 1000;
  const FILE_STEM = 'voice-sample';

  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let startedAt = 0;

  let recording = $state(false);
  let seconds = $state(0);
  let url = $state<string | null>(null);
  let problem = $state<string | null>(null);

  function release() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  function discard() {
    if (url) {
      URL.revokeObjectURL(url);
    }
    url = null;
    seconds = 0;
    onrecorded(null);
  }

  async function start() {
    problem = null;
    discard();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      problem = MIC_PROBLEM_MESSAGE[micProblemOf(null, { hasMediaDevices: false })];
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      problem = MIC_PROBLEM_MESSAGE[micProblemOf(error as { name?: string })];
      return;
    }

    const mimeType = recorderMime((m) => MediaRecorder.isTypeSupported(m));
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = () => {
      const type = recorder?.mimeType || mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type });
      const extension = type.includes('mp4') ? 'm4a' : 'webm';
      url = URL.createObjectURL(blob);
      const take = { file: new File([blob], `${FILE_STEM}.${extension}`, { type }), seconds };
      onrecorded(recordingReady(seconds) ? take : null);
      release();
    };
    recorder.start(MS_PER_SECOND);
    startedAt = Date.now();
    recording = true;
    timer = setInterval(() => {
      seconds = Math.round((Date.now() - startedAt) / 100) / 10;
      if (seconds >= CLONE_MAX_SECONDS) {
        stop();
      }
    }, TICK_MS);
  }

  function stop() {
    recording = false;
    recorder?.stop();
  }

  onDestroy(() => {
    release();
    if (url) {
      URL.revokeObjectURL(url);
    }
  });
</script>

<div class="recorder">
  <p class="script">{CLONE_SCRIPT}</p>
  <div class="row">
    {#if recording}
      <button type="button" class="primary" onclick={stop}>Stop</button>
    {:else}
      <button type="button" class="primary" onclick={start}>{url ? 'Record again' : 'Record'}</button>
    {/if}
    <span class="time" class:short={seconds > 0 && seconds < CLONE_MIN_SECONDS}>
      {Math.floor(seconds)}s / at least {CLONE_MIN_SECONDS}s
    </span>
  </div>
  {#if url && !recording}
    <audio controls src={url}></audio>
    {#if !recordingReady(seconds)}
      <p class="problem">Record between {CLONE_MIN_SECONDS} and {CLONE_MAX_SECONDS} seconds.</p>
    {/if}
  {/if}
  {#if problem}
    <p class="problem" role="alert">{problem}</p>
  {/if}
</div>

<style>
  .recorder {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .script {
    margin: 0;
    padding: 8px;
    max-height: 120px;
    overflow: auto;
    line-height: 1.5;
    background: var(--paper-2, #f9f9f9);
    border: 1px solid var(--line, #e5e5e5);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .time.short {
    color: var(--danger, #c0392b);
  }
  .problem {
    margin: 0;
    color: var(--danger, #c0392b);
  }
  audio {
    width: 100%;
  }
  button {
    padding: 4px 10px;
    font: inherit;
    border: 1px solid var(--line-2, #d2d2d7);
    background: var(--paper, #fff);
    color: var(--ink, #1d1d1f);
    cursor: pointer;
  }
  .primary {
    background: var(--ink, #1d1d1f);
    color: var(--paper, #fff);
  }
</style>
