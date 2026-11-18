<script lang="ts">
  import { Place, Step, type Peer } from '$lib/onboarding/flow';
  import { markOf } from '$lib/acp/agent-marks';
  import AsciiField from './AsciiField.svelte';

  type Props = { step: Step; number: number; label: string; name: string; place: Place; agents: Peer[] };

  let { step, number, label, name, place, agents }: Props = $props();

  const MAX_MARKS = 6;

  const firstName = $derived(name.trim().split(/\s+/)[0] ?? '');

  const PLACE_LINE: Readonly<Record<Place, string>> = {
    [Place.Computer]: 'your file. your computer. no account.',
    [Place.Cloud]: 'everyone on the same canvas.'
  };

  const LINES: Readonly<Record<Step, () => string>> = {
    [Step.Home]: () => PLACE_LINE[place],
    [Step.Name]: () => (firstName ? `hi, ${firstName.toLowerCase()}.` : 'hi.'),
    [Step.Agents]: () => (agents.length ? `${agents.length} ready to design with you.` : 'design by hand, or add an AI.'),
    [Step.Memory]: () => 'start from what you know.'
  };

  const line = $derived(LINES[step]());
  const marks = $derived(step === Step.Agents ? agents.slice(0, MAX_MARKS) : []);
</script>

<div class="art" data-step={step} aria-hidden="true">
  <AsciiField />

  {#key step}
    <div class="step-chip">
      <span class="number">{number}</span>
      <span class="label">{label}</span>
    </div>
  {/key}

  <div class="foot">
    {#if marks.length}
      <div class="marks">
        {#each marks as agent, i (agent.id)}
          {@const mark = markOf(agent.id)}
          {#if mark}
            <svg viewBox={mark.viewBox} fill="currentColor" fill-rule={mark.evenodd ? 'evenodd' : 'nonzero'} style:animation-delay="{i * 70}ms">
              {#each mark.paths as d (d)}<path {d} />{/each}
            </svg>
          {/if}
        {/each}
      </div>
    {/if}

    {#key line}
      <p class="line">{line}</p>
    {/key}
  </div>
</div>

<style>
  .art {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: var(--ui-radius-lg);
    background: #000;
    color: #fff;
    font-family: var(--ui-sans, system-ui, sans-serif);
    user-select: none;
  }

  .art::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgb(0 0 0 / 0.55) 0%, rgb(0 0 0 / 0) 28%, rgb(0 0 0 / 0) 55%, rgb(0 0 0 / 0.85) 100%);
    pointer-events: none;
  }

  .step-chip {
    position: absolute;
    z-index: 1;
    top: 40px;
    left: 40px;
    display: flex;
    align-items: baseline;
    gap: 12px;
    animation: rise 520ms var(--ui-ease) both;
  }

  .number {
    font-family: var(--ui-mono);
    font-size: 13px;
    color: rgb(255 255 255 / 0.6);
  }

  .number::after {
    content: ' /';
  }

  .label {
    font-family: var(--ui-mono);
    font-size: 13px;
  }

  .foot {
    position: absolute;
    z-index: 1;
    left: 40px;
    right: 40px;
    bottom: 40px;
  }

  .marks {
    display: flex;
    gap: 14px;
    margin: 0 0 20px;
  }

  .marks svg {
    width: 24px;
    height: 24px;
    animation: rise 520ms var(--ui-ease) both;
  }

  .line {
    margin: 0;
    font-size: clamp(32px, 3.4vw, 56px);
    font-weight: 600;
    letter-spacing: -0.045em;
    line-height: 0.98;
    text-wrap: balance;
    animation: rise 520ms var(--ui-ease) both;
  }

  @keyframes rise {
    from { opacity: 0; transform: translateY(12px); }
  }

  @media (max-width: 860px) {
    .step-chip { top: 16px; left: 16px; }
    .foot { left: 16px; right: 16px; bottom: 16px; }
    .marks { gap: 10px; margin-bottom: 10px; }
    .marks svg { width: 18px; height: 18px; }
    .line { font-size: 26px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .step-chip, .line, .marks svg {
      animation: none;
    }
  }
</style>
