<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import Download from '@lucide/svelte/icons/download';
  import Check from '@lucide/svelte/icons/check';
  import Lock from '@lucide/svelte/icons/lock';
  import TourFilm from '../../TourFilm.svelte';
</script>

<div class="scene">
  <div class="sheet">
    <span class="handle"></span>
    <header>
      <b>Export</b>
      <X size={18} strokeWidth={1.8} />
    </header>
    <div class="tabs"><span class="on">Video</span><span>Embed</span></div>
    <div class="fit"><div class="frame"><TourFilm /></div></div>
    <div class="row">
      <span>MP4 · 1080p · 24 s</span>
      <span class="file"><Check size={15} strokeWidth={2.4} /> acme-launch.mp4 · 12.4 MB</span>
    </div>
    <div class="download">
      <span class="label"><Download size={17} strokeWidth={2} /> Download</span>
      <span class="fill"></span>
    </div>
  </div>

  <div class="site-beat">
    <div class="browser">
      <div class="chrome"><span class="url"><Lock size={12} strokeWidth={2} /> acme.com</span></div>
      <div class="site">
        <nav><b>acme</b><span class="cta">Sign up</span></nav>
        <h4>the faster way to ship.</h4>
        <p>Plan, build and launch in one place.</p>
        <div class="fit embed"><div class="frame"><TourFilm /></div></div>
      </div>
    </div>
    <code class="snippet">&lt;script src="https://feega.app/e/acme-launch.js"&gt;&lt;/script&gt;</code>
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

  .fit {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    container-type: size;
  }

  .frame {
    width: min(100cqw, 100cqh * 16 / 9);
  }

  .sheet {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    top: 68px;
    display: flex;
    flex-direction: column;
    padding: 8px 16px 16px;
    background: var(--ui-bg, #fff);
    box-shadow: 0 -1px 0 color-mix(in srgb, var(--ui-ink, #111) 8%, transparent), 0 -30px 60px -40px rgba(0, 0, 0, 0.45);
    opacity: 0;
    animation: sheet var(--loop) var(--expo) infinite;
  }

  .handle {
    align-self: center;
    width: 36px;
    height: 4px;
    margin-bottom: 10px;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--ui-ink, #111) 18%, transparent);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 18px;
  }

  header b {
    font-weight: 600;
  }

  .tabs {
    display: flex;
    gap: 4px;
    margin: 12px 0;
    font-size: 14px;
  }

  .tabs span {
    padding: 7px 14px;
    color: var(--ui-ink-2, #5c5c58);
  }

  .tabs .on {
    background: var(--ui-hover, #f2f2ef);
    color: var(--ui-ink, #111);
  }

  .row {
    position: relative;
    flex: none;
    height: 22px;
    margin: 12px 0;
    font-size: 14px;
    color: var(--ui-ink-2, #5c5c58);
  }

  .row > span {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
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
    flex: none;
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

  .site-beat {
    position: absolute;
    inset: 68px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .browser {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--ui-bg, #fff);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-ink, #111) 8%, transparent), 0 40px 80px -40px rgba(0, 0, 0, 0.45);
    animation: browser var(--loop) var(--expo) infinite;
  }

  .chrome {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    background: var(--ui-surface, #fafaf8);
  }

  .url {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 16px;
    border-radius: 9999px;
    background: var(--ui-hover, #f2f2ef);
    font-size: 13px;
    color: var(--ui-ink-2, #5c5c58);
  }

  .site {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 12px 16px 16px;
    background: #fff;
    color: #111;
  }

  nav {
    display: flex;
    align-items: center;
    font-size: 13px;
  }

  nav b {
    margin-right: auto;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.04em;
  }

  .cta {
    padding: 6px 12px;
    border-radius: 9999px;
    background: #111;
    color: #fff;
  }

  h4 {
    margin: 16px 0 0;
    font-size: 30px;
    font-weight: 600;
    letter-spacing: -0.05em;
    line-height: 0.95;
  }

  .site p {
    margin: 8px 0 12px;
    font-size: 14px;
    line-height: 1.4;
    color: #5c5c58;
  }

  .embed .frame {
    animation: embed var(--loop) var(--expo) infinite;
  }

  .snippet {
    flex: none;
    padding: 12px 14px;
    background: var(--ui-ink, #111);
    color: var(--ui-bg, #fff);
    font-family: var(--ui-mono, monospace);
    font-size: 12px;
    line-height: 1.5;
    overflow-wrap: anywhere;
    animation: snippet var(--loop) var(--expo) infinite;
  }

  @keyframes sheet {
    0% { opacity: 0; transform: translateY(60px); }
    6%, 42% { opacity: 1; transform: none; }
    47%, 100% { opacity: 0; transform: translateY(40px); }
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
    54%, 100% { opacity: 1; transform: none; }
  }

  @keyframes snippet {
    0%, 50% { opacity: 0; transform: translateY(20px); }
    56%, 100% { opacity: 1; transform: none; }
  }

  @keyframes embed {
    0%, 56% { opacity: 0; transform: scale(0.9); }
    64%, 100% { opacity: 1; transform: none; }
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
