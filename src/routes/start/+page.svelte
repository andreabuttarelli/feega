<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { START_STEPS, STEP_LABEL, StartStep, StepState, runBrandStep, runStart, type StartOutcome } from '$lib/start/start-steps';
  import { startPorts } from '$lib/start/start-client';

  let { data } = $props();

  const ports = startPorts();
  let states = $state<Record<StartStep, StepState>>(Object.fromEntries(START_STEPS.map((s) => [s, StepState.Waiting])) as Record<StartStep, StepState>);
  let outcome = $state<StartOutcome | null>(null);
  let retrying = $state(false);

  const report = (step: StartStep, state: StepState) => {
    states[step] = state;
  };

  const shown = $derived(START_STEPS.filter((s) => states[s] !== StepState.Waiting));
  const stuckOnBrand = $derived(outcome !== null && outcome.scope !== null && !outcome.branded);

  function labelOf(step: StartStep): string {
    return STEP_LABEL[step][states[step] === StepState.Failed ? 'failed' : 'running'](data.host);
  }

  async function open(next: string) {
    report(StartStep.Open, StepState.Running);
    await goto(next, { replaceState: true });
  }

  async function retryBrand() {
    if (!outcome?.scope) {
      return;
    }
    retrying = true;
    const branded = await runBrandStep(outcome.scope, data.url, ports, report);
    retrying = false;
    outcome = { ...outcome, branded };
    if (branded) {
      await open(outcome.next);
    }
  }

  onMount(async () => {
    outcome = await runStart(data.url, ports, report);
    if (outcome.branded || !outcome.scope) {
      await goto(outcome.next, { replaceState: true });
    }
  });
</script>

<svelte:head>
  <title>Starting {data.host} · Feega</title>
</svelte:head>

<main class="start" data-testid="start-page">
  <h1>{data.host}</h1>
  <ol class="steps" aria-live="polite">
    {#each shown as step (step)}
      <li class="step" data-state={states[step]} data-testid="start-step-{step}">
        <span class="dot" aria-hidden="true"></span>
        <span>{labelOf(step)}</span>
      </li>
    {/each}
  </ol>
  {#if stuckOnBrand && outcome}
    <div class="actions">
      <button class="primary rounded-sm" disabled={retrying} onclick={() => void retryBrand()} data-testid="start-retry-brand">Try again</button>
      <button class="rounded-sm" onclick={() => outcome && void open(outcome.next)} data-testid="start-open-canvas">Open canvas</button>
    </div>
  {/if}
  {#if outcome && !outcome.scope}
    <a class="home" href="/app">Go to your workspace</a>
  {/if}
</main>

<style>
  .start { min-height: 100dvh; display: flex; flex-direction: column; justify-content: center; gap: 32px; padding: 48px 16px; max-width: 640px; margin: 0 auto; background: var(--ui-app); color: var(--ui-text); }
  h1 { margin: 0; font-size: clamp(36px, 10vw, 72px); font-weight: 600; letter-spacing: -0.04em; line-height: 0.95; text-transform: lowercase; overflow-wrap: anywhere; }
  .steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; font-size: 15px; }
  .step { display: flex; align-items: center; gap: 12px; color: var(--ui-text-2); transition: color 200ms var(--ui-ease); }
  .step[data-state='running'] { color: var(--ui-text); }
  .step[data-state='failed'] { color: var(--ui-text); }
  .dot { width: 8px; height: 8px; border-radius: 999px; background: var(--ui-text-3, currentColor); flex: none; }
  .step[data-state='running'] .dot { background: var(--ui-accent); animation: pulse 1s var(--ui-ease) infinite alternate; }
  .step[data-state='done'] .dot { background: var(--ui-text); }
  .step[data-state='failed'] .dot { background: #e5484d; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  button { font: inherit; font-size: 13px; font-weight: 600; min-height: 44px; padding: 0 16px; border: 0; cursor: pointer; background: var(--ui-wash); color: var(--ui-text); }
  button.primary { background: var(--ui-accent-solid); color: #fff; }
  button:disabled { opacity: 0.5; cursor: default; }
  .home { font-size: 13px; color: var(--ui-accent-text); }
  @keyframes pulse { from { opacity: 0.4; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .step[data-state='running'] .dot { animation: none; } }
</style>
