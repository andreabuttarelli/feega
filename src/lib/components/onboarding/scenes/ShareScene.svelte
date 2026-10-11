<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import Download from '@lucide/svelte/icons/download';
  import Check from '@lucide/svelte/icons/check';
  import Lock from '@lucide/svelte/icons/lock';
  import TourFilm from '../TourFilm.svelte';
</script>

<div class="scene">
  <div class="dialog">
    <header>
      <b>Export</b>
      <X size={18} strokeWidth={1.8} />
    </header>
    <div class="tabs"><span class="on">Video</span><span>Embed</span></div>
    <TourFilm />
    <div class="row">
      <span>MP4 · 1080p · 24 s</span>
      <span class="file"><Check size={15} strokeWidth={2.4} /> acme-launch.mp4 · 12.4 MB</span>
    </div>
    <div class="download">
      <span class="label"><Download size={17} strokeWidth={2} /> Download</span>
      <span class="fill"></span>
    </div>
  </div>

  <div class="browser">
    <div class="chrome">
      <span class="lights"><i></i><i></i><i></i></span>
      <span class="url"><Lock size={12} strokeWidth={2} /> acme.com</span>
    </div>
    <div class="site">
      <nav><b>acme</b><span>Product</span><span>Pricing</span><span class="cta">Sign up</span></nav>
      <div class="hero">
        <div class="copy">
          <h4>the faster way to ship.</h4>
          <p>Plan, build and launch in one place. Teams on the new plan grew revenue 38%.</p>
        </div>
        <div class="embed"><TourFilm /></div>
      </div>
    </div>
  </div>

  <code class="snippet">&lt;script src="https://feega.app/e/acme-launch.js"&gt;&lt;/script&gt;</code>
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

  .dialog {
    position: absolute;
    left: 230px;
    top: 60px;
    width: 500px;
    padding: 20px 24px 24px;
    background: var(--ui-bg, #fff);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-ink, #111) 8%, transparent), 0 40px 80px -40px rgba(0, 0, 0, 0.45);
    opacity: 0;
    animation: dialog var(--loop) var(--expo) infinite;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 19px;
  }

  header b {
    font-weight: 600;
  }

  .tabs {
    display: flex;
    gap: 4px;
    margin: 16px 0;
    font-size: 14px;
  }

  .tabs span {
    padding: 8px 16px;
    color: var(--ui-ink-2, #5c5c58);
  }

  .tabs .on {
    background: var(--ui-hover, #f2f2ef);
    color: var(--ui-ink, #111);
  }

  .row {
    position: relative;
    height: 22px;
    margin: 16px 0;
    font-size: 15px;
    color: var(--ui-ink-2, #5c5c58);
  }

  .row > span {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .row > span:first-child {
    animation: swap-out var(--loop) var(--expo) infinite;
  }

  .file {
    color: var(--ui-ink, #111);
    opacity: 0;
    animation: swap-in var(--loop) var(--expo) infinite;
  }

  .file :global(svg) {
    color: #16a34a;
  }

  .download {
    position: relative;
    height: 52px;
    overflow: hidden;
    background: var(--ui-accent, #0099ff);
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    animation: press var(--loop) var(--expo) infinite;
  }

  .label {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 100%;
  }

  .fill {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.22);
    transform: scaleX(0);
    transform-origin: left;
    animation: fill var(--loop) linear infinite;
  }

  .browser {
    position: absolute;
    left: 120px;
    top: 50px;
    width: 720px;
    height: 400px;
    background: var(--ui-bg, #fff);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-ink, #111) 8%, transparent), 0 40px 80px -40px rgba(0, 0, 0, 0.45);
    animation: browser var(--loop) var(--expo) infinite;
  }

  .chrome {
    display: flex;
    align-items: center;
    height: 40px;
    padding: 0 14px;
    background: var(--ui-surface, #fafaf8);
  }

  .lights {
    display: flex;
    gap: 6px;
  }

  .lights i {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--ui-ink, #111) 16%, transparent);
  }

  .url {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 auto;
    padding: 5px 16px;
    border-radius: 9999px;
    background: var(--ui-hover, #f2f2ef);
    font-size: 13px;
    color: var(--ui-ink-2, #5c5c58);
  }

  .site {
    padding: 16px 28px;
    background: #fff;
    color: #111;
    height: calc(100% - 40px);
  }

  nav {
    display: flex;
    align-items: center;
    gap: 22px;
    font-size: 13px;
    color: #5c5c58;
  }

  nav b {
    margin-right: auto;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.04em;
    color: #111;
  }

  .cta {
    padding: 7px 14px;
    border-radius: 9999px;
    background: #111;
    color: #fff;
  }

  .hero {
    display: grid;
    grid-template-columns: 1fr 360px;
    align-items: center;
    gap: 28px;
    height: calc(100% - 40px);
  }

  h4 {
    margin: 0;
    font-size: 40px;
    font-weight: 600;
    letter-spacing: -0.05em;
    line-height: 0.95;
  }

  .copy p {
    margin: 14px 0 0;
    font-size: 14px;
    line-height: 1.45;
    color: #5c5c58;
  }

  .embed {
    animation: embed var(--loop) var(--expo) infinite;
  }

  .snippet {
    position: absolute;
    left: 50%;
    top: 480px;
    padding: 14px 22px;
    background: var(--ui-ink, #111);
    color: var(--ui-bg, #fff);
    font-family: var(--ui-mono, monospace);
    font-size: 15px;
    white-space: nowrap;
    transform: translateX(-50%);
    animation: snippet var(--loop) var(--expo) infinite;
  }

  @keyframes dialog {
    0% { opacity: 0; transform: translateY(24px); }
    6%, 42% { opacity: 1; transform: none; }
    47%, 100% { opacity: 0; transform: translateY(-24px); }
  }

  @keyframes press {
    0%, 14% { transform: none; }
    15.5% { transform: scale(0.97); }
    18%, 100% { transform: none; }
  }

  @keyframes fill {
    0%, 16% { transform: scaleX(0); }
    30%, 100% { transform: scaleX(1); }
  }

  @keyframes swap-out {
    0%, 30% { opacity: 1; }
    33%, 100% { opacity: 0; }
  }

  @keyframes swap-in {
    0%, 31% { opacity: 0; transform: translateY(8px); }
    35%, 100% { opacity: 1; transform: none; }
  }

  @keyframes browser {
    0%, 46% { opacity: 0; transform: translateY(40px) scale(0.96); }
    54%, 96% { opacity: 1; transform: none; }
    100% { opacity: 0; transform: none; }
  }

  @keyframes snippet {
    0%, 50% { opacity: 0; transform: translate(-50%, 20px); }
    56%, 96% { opacity: 1; transform: translate(-50%, 0); }
    100% { opacity: 0; transform: translate(-50%, 0); }
  }

  @keyframes embed {
    0%, 56% { opacity: 0; transform: scale(0.9); }
    64%, 100% { opacity: 1; transform: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .scene * {
      animation: none !important;
    }
  }
</style>
