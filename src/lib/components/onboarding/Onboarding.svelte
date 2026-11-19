<script lang="ts">
  import { onMount } from 'svelte';
  import { apiCall } from '$lib/api/client';
  import { track } from '$lib/analytics';
  import { AgentChoices } from '$lib/acp/agent-choices.svelte';
  import { AGENT_STATUS, statusOf } from '$lib/acp/agent-status';
  import { Account, Arrival, LOCAL_ONBOARDING_PATH, Place, Step, Surface, labelOf } from '$lib/onboarding/flow';
  import { OnboardingSession, type Call } from '$lib/onboarding/session.svelte';
  import { opensOnArrival, type TourState } from '$lib/onboarding/tour';
  import { rememberTourSeen, seenInBrowser } from '$lib/onboarding/tour-memory';
  import FeegaMark from '$lib/components/FeegaMark.svelte';
  import OnboardingArt from './OnboardingArt.svelte';
  import StepAccount from './StepAccount.svelte';
  import StepAgents from './StepAgents.svelte';
  import StepHome from './StepHome.svelte';
  import StepMemory from './StepMemory.svelte';
  import StepName from './StepName.svelte';

  let { surface, tour, viewerName }: { surface: Surface; tour: TourState; viewerName: string | null } = $props();

  const localCall: Call = async (path, init) => {
    const res = await fetch(path, init);
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };

  const rememberHere = async () => {
    await fetch(LOCAL_ONBOARDING_PATH, { method: 'PUT' });
  };

  const SURFACES: Readonly<Record<Surface, { call: Call; remember: () => Promise<void> }>> = {
    [Surface.Web]: { call: apiCall, remember: () => rememberTourSeen() },
    [Surface.Desktop]: { call: apiCall, remember: () => rememberTourSeen() },
    [Surface.Local]: { call: localCall, remember: rememberHere }
  };

  const session = new OnboardingSession({
    ...SURFACES[surface],
    track,
    open: (url) => window.open(url, '_blank', 'noopener'),
    wait: (ms) => new Promise((done) => setTimeout(done, ms))
  });
  const choices = new AgentChoices();

  let name = $state(surface === Surface.Local ? '' : (viewerName ?? ''));
  let sheet = $state<HTMLElement | null>(null);
  let place = $state(Place.Computer);

  const ready = $derived(choices.agents.filter((agent) => AGENT_STATUS[statusOf(agent)].rank === 0));

  onMount(() => {
    if (surface === Surface.Local) {
      void session.beginLocal();
      void choices.load();
      return;
    }

    session.begin({
      surface,
      arrival: opensOnArrival(tour, seenInBrowser()) ? Arrival.FirstRun : Arrival.Returning,
      account: Account.SignedIn,
      name: viewerName
    });
  });

  $effect(() => {
    if (session.step) {
      sheet?.scrollTo({ top: 0 });
    }
  });

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && session.step && session.step !== Step.Name) {
      session.skip();
    }
  }
</script>

<svelte:window {onkeydown} />

{#if session.step}
  {@const step = session.step}
  <div class="onboarding" bind:this={sheet} role="dialog" aria-modal="true" aria-labelledby="ob-title" data-testid="onboarding" data-step={step}>
    <div class="art">
      <OnboardingArt {step} number={session.index + 1} label={labelOf(step)} {name} {place} agents={ready.map((agent) => ({ id: agent.id, name: agent.name.toLowerCase() }))} />
    </div>

    <div class="side">
      <header>
        <span class="brand"><FeegaMark size={22} /> feega</span>
        {#if step !== Step.Name}
          <button type="button" class="ob-link top" onclick={() => session.skip()} data-testid="onboarding-skip">skip</button>
        {/if}
      </header>

      <main>
        <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={session.plan.length} aria-valuenow={session.index + 1}>
          <i style:width="{session.progress * 100}%"></i>
        </div>

        {#key step}
          <section class="step">
            {#if step === Step.Name}
              <StepName bind:name onsave={(value) => session.saveName(value)} />
            {:else if step === Step.Account}
              <StepAccount email={session.email} connection={session.connection} onconnect={() => session.connect()} oncontinue={() => session.next()} />
            {:else if step === Step.Home}
              <StepHome bind:place email={session.email} oncontinue={() => session.next()} oncloud={() => session.openCloud()} onsignin={() => session.back()} />
            {:else if step === Step.Agents}
              <StepAgents agents={choices.agents} chosen={choices.chosen} refreshing={choices.refreshing} onchoose={(id) => choices.choose(id)} onrefresh={() => choices.refresh()} oncontinue={() => session.next()} />
            {:else}
              <StepMemory sources={session.sources} onread={(ids) => session.readSources(ids)} onsave={(content) => session.saveMemory(content)} onskip={() => session.next()} />
            {/if}
          </section>
        {/key}

        {#if !session.first}
          <button type="button" class="ob-link back" onclick={() => session.back()} data-testid="onboarding-back">← back</button>
        {/if}
      </main>
    </div>
  </div>
{/if}

{#if session.unsaved}
  <div class="unsaved" role="status" data-testid="onboarding-unsaved">
    {session.unsaved}
    <button type="button" onclick={() => (session.unsaved = null)}>ok</button>
  </div>
{/if}

<style>
  .onboarding {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1fr);
    background: var(--ui-panel);
    color: var(--ui-text);
    font-family: var(--ui-sans, system-ui, sans-serif);
    animation: fade 320ms var(--ui-ease);
  }

  .art {
    min-height: 0;
    padding: 12px 0 12px 12px;
  }

  .side {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 0;
    overflow-y: auto;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 28px 48px 0;
  }

  .brand {
    display: inline-flex;
    line-height: 1;
    align-items: center;
    gap: 8px;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.03em;
  }

  main {
    align-self: safe center;
    width: min(440px, 100%);
    margin: 0 auto;
    padding: 32px 24px 64px;
  }

  .progress {
    height: 4px;
    margin: 0 0 32px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-input);
    overflow: hidden;
  }

  .progress i {
    display: block;
    height: 100%;
    border-radius: var(--ui-radius-full);
    background: linear-gradient(90deg, var(--ui-text) calc(100% - 12px), var(--brand-orange, #ff6a1a) calc(100% - 12px));
    transition: width 520ms var(--ui-ease);
  }

  .step {
    animation: rise 520ms var(--ui-ease) both;
  }

  .onboarding :global(.ob-title) {
    margin: 0 0 12px;
    font-size: clamp(36px, 3.6vw, 52px);
    font-weight: 600;
    letter-spacing: -0.045em;
    line-height: 0.98;
    text-transform: lowercase;
    text-wrap: balance;
  }

  .onboarding :global(.ob-sub) {
    margin: 0 0 24px;
    font-size: 15px;
    line-height: 1.45;
    color: var(--ui-text-secondary);
    text-wrap: pretty;
  }

  .onboarding :global(.ob-form) {
    display: grid;
    gap: 8px;
  }

  .onboarding :global(.ob-input) {
    width: 100%;
    min-height: 48px;
    padding: 0 16px;
    border: 0;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: 15px;
  }

  .onboarding :global(.ob-input:focus-visible),
  .onboarding :global(.ob-primary:focus-visible),
  .onboarding :global(.ob-secondary:focus-visible),
  .onboarding :global(.ob-link:focus-visible) {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  .onboarding :global(.ob-primary),
  .onboarding :global(.ob-secondary) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: var(--ui-radius-full);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 200ms var(--ui-ease), transform 200ms var(--ui-ease);
  }

  .onboarding :global(.ob-primary) {
    width: 100%;
    min-height: 48px;
    background: var(--ui-text);
    color: var(--ui-panel);
    font-size: 15px;
  }

  .onboarding :global(.ob-primary:active),
  .onboarding :global(.ob-secondary:active) {
    transform: scale(0.985);
  }

  .onboarding :global(.ob-primary:disabled),
  .onboarding :global(.ob-secondary:disabled) {
    opacity: 0.35;
    cursor: default;
  }

  .onboarding :global(.ob-secondary) {
    min-height: 36px;
    padding: 0 16px;
    background: var(--ui-panel);
    color: var(--ui-text);
    font-size: 13px;
    box-shadow: inset 0 0 0 1px var(--ui-divider);
  }

  .onboarding :global(.ob-link),
  .ob-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 4px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-secondary);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }

  .onboarding :global(.ob-link:hover) {
    color: var(--ui-text);
  }

  .onboarding :global(.ob-primary + .ob-link) {
    display: flex;
    margin: 4px auto 0;
  }

  .onboarding :global(.ob-foot) {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--ui-text-tertiary);
    text-align: center;
    text-wrap: balance;
  }

  .back {
    margin-top: 4px;
  }

  .unsaved {
    position: fixed;
    left: 50%;
    bottom: 24px;
    z-index: 10001;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px 10px 16px;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel-raised, var(--ui-panel));
    box-shadow: var(--ui-shadow-float);
    color: var(--ui-text);
    font-size: 13px;
    transform: translateX(-50%);
  }

  .unsaved button {
    min-height: 28px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  @keyframes fade {
    from { opacity: 0; }
  }

  @keyframes rise {
    from { opacity: 0; transform: translateY(12px); }
  }

  @media (max-width: 860px) {
    .onboarding {
      display: block;
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    .art {
      display: none;
    }

    .side {
      display: block;
      overflow: visible;
    }

    header {
      padding: 16px 20px 0;
    }

    main {
      align-self: start;
      padding: 20px 20px calc(24px + env(safe-area-inset-bottom));
    }

    .progress {
      margin-bottom: 20px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .onboarding,
    .step {
      animation: none;
    }
  }
</style>
