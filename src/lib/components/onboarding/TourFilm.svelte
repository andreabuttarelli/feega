<script lang="ts">
  let { accent = '#ffffff', intro = 'ship it.', ratio = '16 / 9' }: { accent?: string; intro?: string; ratio?: string } = $props();

  const BARS = [38, 52, 46, 64, 58, 78, 92];
</script>

<div class="film" style:--film-accent={accent} style:aspect-ratio={ratio} aria-hidden="true">
  <div class="beat title">
    {#each intro.split(' ') as word, i (i)}
      <span class="word" style:--i={i}><span>{word}</span></span>
    {/each}
  </div>

  <div class="beat card">
    <div class="panel">
      <div class="panel-head">
        <span class="dot"></span>
        <span class="label">Revenue</span>
        <span class="delta">+38%</span>
      </div>
      <div class="bars">
        {#each BARS as h, i (i)}
          <span style:--h="{h}%" style:--i={i}></span>
        {/each}
      </div>
    </div>
  </div>

  <div class="beat mark">
    <span class="logo"></span>
    <span class="name">acme</span>
    <span class="url">acme.com</span>
  </div>

  <span class="progress"></span>
</div>

<style>
  .film {
    --loop: 6s;
    --expo: cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
    width: 100%;
    overflow: hidden;
    container-type: inline-size;
    background: #050505;
    color: #fff;
    font-family: var(--ui-sans, 'DM Sans', system-ui, sans-serif);
  }

  .beat {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    animation: beat var(--loop) linear infinite;
  }

  .title {
    gap: 0.25em;
    font-size: 13cqw;
    font-weight: 600;
    letter-spacing: -0.05em;
    color: var(--film-accent);
    animation-name: beat-title;
  }

  .word {
    display: inline-block;
    overflow: hidden;
    line-height: 1.05;
  }

  .word span {
    display: inline-block;
    animation: rise var(--loop) var(--expo) infinite;
    animation-delay: calc(var(--i) * 0.12s);
  }

  .card {
    animation-name: beat-card;
    perspective: 60cqw;
  }

  .panel {
    width: 56cqw;
    padding: 3.2cqw;
    background: #fff;
    color: #111;
    animation: tilt var(--loop) var(--expo) infinite;
  }

  .panel-head {
    display: flex;
    align-items: center;
    gap: 1.4cqw;
    font-size: 2.8cqw;
    font-weight: 600;
  }

  .dot {
    width: 1.6cqw;
    height: 1.6cqw;
    border-radius: 50%;
    background: var(--film-accent);
    box-shadow: inset 0 0 0 0.3cqw #111;
  }

  .delta {
    margin-left: auto;
    color: #16a34a;
    font-family: var(--ui-mono, monospace);
  }

  .bars {
    display: flex;
    align-items: flex-end;
    gap: 1.2cqw;
    height: 18cqw;
    margin-top: 2.4cqw;
  }

  .bars span {
    flex: 1;
    height: var(--h);
    background: #111;
    transform-origin: bottom;
    animation: grow var(--loop) var(--expo) infinite;
    animation-delay: calc(var(--i) * 0.05s);
  }

  .bars span:last-child {
    background: #0099ff;
  }

  .mark {
    flex-direction: column;
    gap: 1.6cqw;
    animation-name: beat-mark;
  }

  .logo {
    width: 8cqw;
    height: 8cqw;
    border-radius: 50%;
    background: var(--film-accent);
  }

  .name {
    font-size: 9cqw;
    font-weight: 600;
    letter-spacing: -0.05em;
    line-height: 0.9;
  }

  .url {
    font-family: var(--ui-mono, monospace);
    font-size: 2.4cqw;
    color: rgba(255, 255, 255, 0.55);
  }

  .progress {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 0.6cqw;
    background: var(--film-accent);
    transform-origin: left;
    animation: play var(--loop) linear infinite;
    opacity: 0.85;
  }

  @keyframes beat-title {
    0%, 36% { opacity: 1; }
    38%, 100% { opacity: 0; }
  }

  @keyframes beat-card {
    0%, 36% { opacity: 0; }
    38%, 70% { opacity: 1; }
    72%, 100% { opacity: 0; }
  }

  @keyframes beat-mark {
    0%, 70% { opacity: 0; }
    72%, 100% { opacity: 1; }
  }

  @keyframes rise {
    0% { transform: translateY(110%); }
    14%, 100% { transform: translateY(0); }
  }

  @keyframes tilt {
    0%, 36% { transform: translateY(30%) rotateX(28deg) scale(0.9); }
    52%, 100% { transform: none; }
  }

  @keyframes grow {
    0%, 40% { transform: scaleY(0); }
    56%, 100% { transform: scaleY(1); }
  }

  @keyframes play {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .film * {
      animation: none !important;
    }

    .title {
      opacity: 1;
    }
  }
</style>
