<div class="canvas-entry" aria-busy="true" aria-live="polite">
  <div class="canvas-entry-stage">
    <div class="canvas-entry-dots"></div>

    <div class="entry-box entry-topbar-left">
      <div class="entry-block entry-topbar-name"></div>
    </div>
    <div class="entry-box entry-topbar-right">
      <div class="entry-block entry-topbar-pill"></div>
      <div class="entry-block entry-topbar-btn"></div>
      <div class="entry-block entry-topbar-icon"></div>
    </div>

    <div class="entry-box entry-rail">
      <div class="entry-rail-group">
        {#each [1, 2, 3] as _}
          <div class="entry-block entry-rail-icon"></div>
        {/each}
      </div>
      <div class="entry-rail-divider"></div>
      <div class="entry-rail-group">
        {#each [1, 2, 3] as _}
          <div class="entry-block entry-rail-icon"></div>
        {/each}
      </div>
    </div>

    <div class="entry-box entry-addbar">
      {#each [1, 2, 3, 4, 5] as _}
        <div class="entry-block entry-addbar-icon"></div>
      {/each}
    </div>
  </div>

  <div class="entry-chat">
    <div class="entry-chat-tabs">
      <div class="entry-block entry-chat-tab"></div>
      <div class="entry-block entry-chat-tab"></div>
    </div>
    <div class="entry-chat-body">
      <div class="entry-block entry-chat-line w-60"></div>
      <div class="entry-block entry-chat-line w-90"></div>
      <div class="entry-block entry-chat-line w-40"></div>
    </div>
  </div>
</div>

<style>
  .canvas-entry {
    position: fixed;
    inset: 0;
    z-index: 9998;
    display: flex;
    background: var(--paper-2, #f9f9f9);
  }

  .canvas-entry-stage {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
  }

  .canvas-entry-dots {
    position: absolute;
    inset: 0;
    background-color: var(--paper, #fff);
    background-image: radial-gradient(var(--line-2, #d2d2d7) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  .entry-box {
    position: absolute;
    z-index: 20;
    display: flex;
    align-items: center;
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    box-shadow: 0 4px 18px rgb(0 0 0 / 0.1);
  }

  .entry-topbar-left {
    top: 8px;
    left: 8px;
    height: 44px;
    padding: 0 10px;
    gap: 6px;
  }
  .entry-topbar-name {
    width: 140px;
    height: 12px;
  }

  .entry-topbar-right {
    top: 8px;
    right: 8px;
    height: 44px;
    padding: 0 4px;
    gap: 6px;
  }
  .entry-topbar-pill {
    width: 40px;
    height: 22px;
  }
  .entry-topbar-btn {
    width: 64px;
    height: 30px;
  }
  .entry-topbar-icon {
    width: 30px;
    height: 30px;
  }

  .entry-rail {
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px 5px;
  }
  .entry-rail-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .entry-rail-divider {
    width: 20px;
    height: 1px;
    background: var(--line, #ededef);
    margin: 2px 0;
  }
  .entry-rail-icon {
    width: 34px;
    height: 34px;
  }

  .entry-addbar {
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    gap: 3px;
    padding: 4px;
  }
  .entry-addbar-icon {
    width: 33px;
    height: 33px;
  }

  .entry-chat {
    flex: 0 0 auto;
    width: 340px;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--paper-2, #f9f9f9);
    border-left: 1px solid var(--line, #ededef);
    box-sizing: border-box;
    padding: 10px 14px;
    gap: 14px;
  }
  .entry-chat-tabs {
    display: flex;
    gap: 8px;
  }
  .entry-chat-tab {
    width: 64px;
    height: 26px;
  }
  .entry-chat-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .entry-chat-line {
    height: 12px;
    width: 100%;
  }
  .w-60 { width: 60%; }
  .w-90 { width: 90%; }
  .w-40 { width: 40%; }

  .entry-block {
    background: color-mix(in srgb, var(--ink, #111) 7%, transparent);
    animation: canvas-entry-pulse 1.2s ease-in-out infinite;
  }

  @keyframes canvas-entry-pulse {
    0%,
    100% {
      opacity: 0.55;
    }
    50% {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .entry-block {
      animation: none;
    }
  }

  @media (max-width: 767px) {
    .entry-chat {
      display: none;
    }
  }
</style>
