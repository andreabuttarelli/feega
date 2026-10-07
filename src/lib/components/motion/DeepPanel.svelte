<script lang="ts">
  import { onMount } from 'svelte';
  import { DEEP_PHASE_LABEL, DeepPhase, type DeepQuote, type DeepView } from '$lib/motion/deep';

  let { url, quote = $bindable(null), onchange }: { url: string; quote: DeepQuote | null; onchange: () => void } = $props();

  const POLL_MS = 3000;
  const ERRORS: Record<string, string> = {
    credits_short: 'Not enough credits for this job.',
    deep_job_running: 'A Deep job is already running on this video.',
    blocked_by_moderation: 'This request was blocked by the safety review.'
  };

  let job = $state<DeepView | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const running = $derived(job?.status === 'running' || job?.status === 'finishing');
  const lastNote = $derived(job?.notes.at(-1) ?? null);

  async function poll() {
    const res = await fetch(url).catch(() => null);
    const body = res?.ok ? ((await res.json()) as { job: DeepView | null }) : null;
    const was = running;
    job = body?.job ?? job;
    if (was && !running) {
      onchange();
    }
    schedule();
  }

  function schedule() {
    if (timer) {
      clearTimeout(timer);
    }
    timer = running ? setTimeout(() => void poll(), POLL_MS) : null;
  }

  async function confirm() {
    if (!quote) {
      return;
    }
    busy = true;
    error = null;
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: quote.message, model: quote.model, reasoning: quote.reasoning }) });
    const body = (await res.json().catch(() => ({}))) as { job?: DeepView; error?: string };
    busy = false;
    if (!res.ok || !body.job) {
      error = ERRORS[body.error ?? ''] ?? 'The job could not start.';
      return;
    }
    quote = null;
    job = body.job;
    onchange();
    schedule();
  }

  async function stop() {
    busy = true;
    await fetch(`${url}/stop`, { method: 'POST' }).catch(() => null);
    busy = false;
    void poll();
  }

  onMount(() => {
    void poll();
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  });
</script>

{#if quote}
  <section class="deep" data-testid="deep-quote">
    <header>Deep job</header>
    <p>Storyboard, build, render and review up to {quote.iterations} times. About {quote.minutes} min, ~{quote.credits} credits (max {quote.capCredits}). You can close the tab.</p>
    {#if error}<p class="error">{error}</p>{/if}
    <div class="actions">
      <button type="button" class="primary" disabled={busy} data-testid="deep-confirm" onclick={confirm}>Start · {quote.credits} credits</button>
      <button type="button" disabled={busy} onclick={() => (quote = null)}>Cancel</button>
    </div>
  </section>
{:else if job && running}
  <section class="deep" data-testid="deep-job" aria-live="polite">
    <header>
      <span>{DEEP_PHASE_LABEL[job.phase]}{job.iteration && job.phase !== DeepPhase.Storyboard && job.phase !== DeepPhase.Assets ? ` · round ${job.iteration} of ${job.maxIterations}` : ''}</span>
      <span class="credits">{job.spentCredits} / {job.capCredits} credits</span>
    </header>
    {#if lastNote}<p class="note">{lastNote.text}</p>{/if}
    {#if job.verdict}<p class="note">Last review: {job.verdict.score}/10{job.verdict.pass ? ', passes' : ''}</p>{/if}
    <div class="actions">
      <button type="button" disabled={busy || job.stopping} data-testid="deep-stop" onclick={stop}>{job.stopping ? 'Stopping…' : 'Stop'}</button>
    </div>
  </section>
{:else if job?.status === 'failed'}
  <section class="deep"><p class="error">The Deep job failed: {job.error}</p></section>
{/if}

<style>
  .deep {
    border-bottom: 1px solid var(--ui-line);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: var(--ui-ink);
    background: var(--ui-bg);
  }

  header {
    display: flex;
    justify-content: space-between;
    font-weight: 600;
  }

  .credits,
  .note {
    color: var(--ui-ink-2);
    font-weight: 400;
  }

  p {
    margin: 0;
  }

  .error {
    color: var(--ui-danger, #c00);
  }

  .actions {
    display: flex;
    gap: 6px;
  }

  button {
    border: 1px solid var(--ui-line);
    background: var(--ui-bg);
    color: var(--ui-ink);
    padding: 4px 10px;
    font-size: 12px;
    cursor: pointer;
  }

  .primary {
    background: var(--ui-accent);
    border-color: var(--ui-accent);
    color: #fff;
  }
</style>
