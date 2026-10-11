<script lang="ts">
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import TourFilm from '../../TourFilm.svelte';

  const STEPS = ['Reading acme.com', 'Writing the script', 'Building 6 scenes', 'Adding music'];
</script>

<div class="scene">
  <div class="beat brief">
    <h3>make a video.</h3>
    <div class="field">
      <span class="typed">acme.com</span>
      <span class="caret"></span>
    </div>
    <span class="go">Make it <ArrowRight size={18} strokeWidth={2} /></span>
  </div>

  <ol class="beat steps">
    {#each STEPS as step, i (step)}
      <li style:--i={i}>
        <span class="tick"><Check size={14} strokeWidth={2.4} /></span>
        {step}
      </li>
    {/each}
    <span class="bar"></span>
  </ol>

  <div class="beat result">
    <TourFilm />
    <div class="meta">
      <span>Launch film</span>
      <span class="mono">0:24 · 16:9 · music</span>
    </div>
  </div>
</div>

<style>
  .scene {
    --loop: 10s;
    --expo: cubic-bezier(0.16, 1, 0.3, 1);
    position: absolute;
    inset: 0;
    font-family: var(--ui-sans, 'DM Sans', system-ui, sans-serif);
    color: var(--ui-ink, #111);
  }

  .beat {
    position: absolute;
    inset: 68px 20px 16px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin: 0;
    padding: 0;
  }

  .brief {
    opacity: 0;
    animation: brief var(--loop) var(--expo) infinite;
  }

  h3 {
    margin: 0 0 20px;
    font-size: 44px;
    font-weight: 600;
    letter-spacing: -0.045em;
    line-height: 0.95;
  }

  .field {
    display: flex;
    align-items: center;
    height: 56px;
    padding-left: 16px;
    background: var(--ui-bg, #fff);
    box-shadow: 0 0 0 1.5px var(--ui-accent, #0099ff), 0 24px 60px -30px rgba(0, 0, 0, 0.4);
    font-size: 18px;
  }

  .typed {
    clip-path: inset(0 100% 0 0);
    animation: type var(--loop) steps(8, end) infinite;
  }

  .caret {
    width: 2px;
    height: 24px;
    margin-left: 2px;
    background: var(--ui-accent, #0099ff);
    animation: blink 1s steps(1) infinite;
  }

  .go {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 52px;
    margin-top: 10px;
    border-radius: 9999px;
    background: var(--ui-ink, #111);
    color: var(--ui-bg, #fff);
    font-size: 16px;
    font-weight: 600;
    animation: press var(--loop) var(--expo) infinite;
  }

  .steps {
    padding: 0 8px;
    list-style: none;
    opacity: 0;
    animation: steps var(--loop) var(--expo) infinite;
  }

  .steps li {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 48px;
    font-size: 19px;
    color: var(--ui-ink-3, #93938e);
    animation: step var(--loop) linear infinite;
    animation-delay: calc(var(--i) * 0.45s);
  }

  .tick {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--ui-accent, #0099ff);
    color: #fff;
    transform: scale(0);
    animation: tick var(--loop) var(--expo) infinite;
    animation-delay: calc(var(--i) * 0.45s);
  }

  .bar {
    display: block;
    height: 3px;
    margin-top: 24px;
    background: var(--ui-accent, #0099ff);
    transform-origin: left;
    animation: fill var(--loop) linear infinite;
  }

  .result {
    animation: result var(--loop) var(--expo) infinite;
  }

  .result :global(.film) {
    box-shadow: 0 40px 80px -40px rgba(0, 0, 0, 0.6);
  }

  .meta {
    display: flex;
    justify-content: space-between;
    margin-top: 12px;
    font-size: 15px;
  }

  .mono {
    font-family: var(--ui-mono, monospace);
    font-size: 13px;
    color: var(--ui-ink-3, #93938e);
  }

  @keyframes brief {
    0% { opacity: 0; transform: translateY(24px); }
    6%, 30% { opacity: 1; transform: none; }
    35%, 100% { opacity: 0; transform: translateY(-40px); }
  }

  @keyframes type {
    0%, 8% { clip-path: inset(0 100% 0 0); }
    20%, 100% { clip-path: inset(0 0 0 0); }
  }

  @keyframes blink {
    50% { opacity: 0; }
  }

  @keyframes press {
    0%, 24% { transform: none; }
    25.5% { transform: scale(0.94); }
    28%, 100% { transform: none; }
  }

  @keyframes steps {
    0%, 32% { opacity: 0; transform: translateY(40px); }
    37%, 55% { opacity: 1; transform: none; }
    59%, 100% { opacity: 0; transform: translateY(-40px); }
  }

  @keyframes step {
    0%, 36% { color: var(--ui-ink-3, #93938e); }
    38%, 100% { color: var(--ui-ink, #111); }
  }

  @keyframes tick {
    0%, 36% { transform: scale(0); }
    40%, 100% { transform: scale(1); }
  }

  @keyframes fill {
    0%, 34% { transform: scaleX(0); }
    56%, 100% { transform: scaleX(1); }
  }

  @keyframes result {
    0%, 57% { opacity: 0; transform: scale(0.86) translateY(40px); }
    66%, 100% { opacity: 1; transform: none; }
  }

  @media (prefers-reduced-motion: no-preference) {
    .scene {
      animation: tour-seam var(--loop) linear infinite;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .scene * {
      animation: none !important;
    }
  }
</style>
