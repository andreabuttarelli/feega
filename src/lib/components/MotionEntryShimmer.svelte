<script lang="ts">
  import { SIDE_DEFAULT_PX } from '$lib/motion/editor-layout';

  const TRACKS = [72, 48, 80, 36];
  const CHAT_LINES = [60, 90, 75, 40];
</script>

<div class="motion-entry" aria-busy="true" aria-label="Opening the editor" data-testid="motion-entry" style={`--side-w: ${SIDE_DEFAULT_PX}px`}>
  <header class="bar">
    <div class="row">
      <i class="block dot"></i>
      <i class="block name"></i>
    </div>
    <div class="row">
      <i class="block dot"></i>
      <i class="block dot big"></i>
      <i class="block dot"></i>
    </div>
    <div class="row end">
      <i class="block time"></i>
      <i class="block pill"></i>
    </div>
  </header>

  <div class="body">
    <section class="stage">
      <div class="block frame"></div>
    </section>

    <section class="timeline">
      <div class="ruler"></div>
      {#each TRACKS as width, i (i)}
        <div class="track">
          <i class="block label"></i>
          <i class="block clip" style={`margin-left: ${i * 6}%; width: ${width}%`}></i>
        </div>
      {/each}
    </section>

    <aside class="side">
      <div class="row">
        <i class="block tab"></i>
        <i class="block tab"></i>
      </div>
      <div class="lines">
        {#each CHAT_LINES as width, i (i)}
          <i class="block line" style={`width: ${width}%`}></i>
        {/each}
      </div>
      <i class="block composer"></i>
    </aside>
  </div>
</div>

<style>
  .motion-entry {
    position: fixed;
    inset: 0;
    z-index: 9998;
    display: flex;
    flex-direction: column;
    background: var(--ui-bg, #fff);
  }

  .bar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    height: 48px;
    padding: 0 8px;
    flex-shrink: 0;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .end {
    justify-content: flex-end;
  }

  .body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--side-w);
    grid-template-rows: minmax(0, 1fr) 360px;
  }

  .stage {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--ui-surface, #fafaf8);
    min-height: 0;
  }

  .frame {
    width: min(100%, calc((100cqh - 48px) * 16 / 9));
    max-height: 100%;
    aspect-ratio: 16 / 9;
  }

  .stage {
    container-type: size;
  }

  .timeline {
    grid-column: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    overflow: hidden;
  }

  .ruler {
    height: 18px;
    background: repeating-linear-gradient(90deg, var(--ui-field, #f2f2f2) 0 1px, transparent 1px 48px);
  }

  .track {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .side {
    grid-column: 2;
    grid-row: 1 / 3;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 12px 16px;
    background: var(--ui-surface, #fafaf8);
  }

  .lines {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .block {
    display: block;
    position: relative;
    overflow: hidden;
    background: color-mix(in srgb, var(--ui-ink, #111) 7%, transparent);
  }

  .block::after {
    content: '';
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--ui-bg, #fff) 60%, transparent), transparent);
    animation: motion-entry-shimmer 1.4s ease-in-out infinite;
  }

  .dot {
    width: 30px;
    height: 30px;
    border-radius: 50%;
  }

  .big {
    width: 36px;
    height: 36px;
  }

  .name {
    width: 140px;
    height: 12px;
  }

  .time {
    width: 72px;
    height: 12px;
  }

  .pill {
    width: 72px;
    height: 30px;
    border-radius: 9999px;
  }

  .label {
    width: 64px;
    height: 12px;
    flex-shrink: 0;
  }

  .clip {
    height: 28px;
  }

  .tab {
    width: 64px;
    height: 26px;
  }

  .line {
    height: 12px;
  }

  .composer {
    height: 88px;
  }

  @keyframes motion-entry-shimmer {
    to {
      transform: translateX(100%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .block::after {
      animation: none;
    }
  }

  @media (max-width: 767px) {
    .bar .row:nth-child(2) {
      display: none;
    }

    .bar {
      grid-template-columns: 1fr 1fr;
    }

    .body {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
    }

    .stage {
      padding: 12px;
      container-type: normal;
    }

    .frame {
      width: 100%;
    }

    .side {
      display: none;
    }
  }
</style>
