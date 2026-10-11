<script lang="ts">
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import Play from '@lucide/svelte/icons/play';
  import SkipBack from '@lucide/svelte/icons/skip-back';
  import SkipForward from '@lucide/svelte/icons/skip-forward';
  import TourFilm from '../TourFilm.svelte';

  const ASK = 'Shorter intro, and make it our blue';

  const TRACKS = [
    { kind: 'TITLE', name: 'ship it.', color: '#4f46e5', from: 0, to: 34 },
    { kind: 'UI', name: 'Revenue card', color: '#db2777', from: 34, to: 70 },
    { kind: 'LOGO', name: 'acme', color: '#16a34a', from: 70, to: 100 },
    { kind: 'AUDIO', name: 'Launch · 120 bpm', color: '#d97706', from: 0, to: 100 }
  ];
</script>

<div class="scene">
  <div class="window">
    <header class="top">
      <span class="crumb"><ArrowLeft size={16} strokeWidth={1.8} /> Acme <i>/</i> <b>Launch film</b></span>
      <span class="transport">
        <SkipBack size={15} strokeWidth={1.8} />
        <Play size={15} strokeWidth={1.8} />
        <SkipForward size={15} strokeWidth={1.8} />
        <span class="mono">00:00:04</span>
      </span>
      <span class="export">Export</span>
    </header>

    <div class="preview">
      <div class="screen">
        <TourFilm />
        <div class="after"><TourFilm accent="#0099ff" /></div>
      </div>
    </div>

    <aside class="chat">
      <div class="tabs"><b>Chat</b><span>Properties</span></div>
      <div class="thread">
        <p class="mine">{ASK}</p>
        <p class="work"><span class="spin"></span>Editing 3 clips</p>
        <p class="reply">Done. The intro is now 1.2 s instead of 2 s, and the title and accents use <span class="swatch"></span><span class="mono">#0099ff</span>.</p>
      </div>
      <div class="ask">
        <span class="draft">{ASK}</span>
        <span class="send"><ArrowUp size={16} strokeWidth={2} /></span>
      </div>
    </aside>

    <section class="timeline">
      {#each TRACKS as track (track.kind)}
        <div class="row">
          <span class="layer" style:--c={track.color}>{track.name}</span>
          <span class="lane">
            <span class="clip" class:intro={track.kind === 'TITLE'} class:shift={track.kind === 'UI' || track.kind === 'LOGO'} style:--c={track.color} style:--from="{track.from}%" style:--width="{track.to - track.from}%">
              <span class="kind">{track.kind}</span>{track.name}
            </span>
          </span>
        </div>
      {/each}
      <span class="playhead"></span>
    </section>
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

  .window {
    position: absolute;
    inset: 24px 40px;
    display: grid;
    grid-template-columns: 1fr 300px;
    grid-template-rows: 48px 1fr 168px;
    background: var(--ui-bg, #fff);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-ink, #111) 8%, transparent), 0 40px 80px -40px rgba(0, 0, 0, 0.45);
  }

  .top {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 0 0 0 16px;
    font-size: 15px;
    box-shadow: 0 1px 0 color-mix(in srgb, var(--ui-ink, #111) 8%, transparent);
  }

  .crumb {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--ui-ink-2, #5c5c58);
  }

  .crumb i {
    font-style: normal;
    opacity: 0.5;
  }

  .crumb b {
    color: var(--ui-ink, #111);
    font-weight: 600;
  }

  .transport {
    display: flex;
    align-items: center;
    gap: 16px;
    margin: 0 auto;
  }

  .mono {
    font-family: var(--ui-mono, monospace);
    font-size: 13px;
  }

  .export {
    display: flex;
    align-items: center;
    align-self: stretch;
    padding: 0 22px;
    background: var(--ui-accent, #0099ff);
    color: #fff;
    font-weight: 600;
  }

  .preview {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: var(--ui-surface, #fafaf8);
  }

  .screen {
    position: relative;
    width: 100%;
  }

  .after {
    position: absolute;
    inset: 0;
    opacity: 0;
    animation: after var(--loop) var(--expo) infinite;
  }

  .chat {
    grid-row: 2 / 4;
    grid-column: 2;
    display: flex;
    flex-direction: column;
    padding: 12px 16px 16px;
    box-shadow: -1px 0 0 color-mix(in srgb, var(--ui-ink, #111) 8%, transparent);
    font-size: 15px;
  }

  .tabs {
    display: flex;
    gap: 18px;
    font-size: 14px;
    color: var(--ui-ink-3, #93938e);
  }

  .tabs b {
    color: var(--ui-ink, #111);
    font-weight: 500;
  }

  .thread {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: auto;
    margin-bottom: 14px;
  }

  .thread p {
    margin: 0;
    line-height: 1.4;
  }

  .mine {
    align-self: flex-end;
    max-width: 85%;
    padding: 10px 14px;
    background: var(--ui-hover, #f2f2ef);
    animation: mine var(--loop) var(--expo) infinite;
  }

  .work {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--ui-ink-2, #5c5c58);
    animation: work var(--loop) var(--expo) infinite;
  }

  .spin {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--ui-accent, #0099ff);
    animation: pulse 0.9s ease-in-out infinite;
  }

  .reply {
    animation: reply var(--loop) var(--expo) infinite;
  }

  .swatch {
    display: inline-block;
    width: 11px;
    height: 11px;
    margin: 0 5px 0 2px;
    border-radius: 50%;
    background: #0099ff;
  }

  .ask {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 56px;
    padding: 0 8px 0 12px;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-ink, #111) 14%, transparent);
    font-size: 14px;
  }

  .draft {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    clip-path: inset(0 100% 0 0);
    animation: draft var(--loop) steps(18, end) infinite;
  }

  .send {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--ui-ink, #111);
    color: var(--ui-bg, #fff);
  }

  .timeline {
    --cut: 13.6%;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    padding: 0 16px;
    box-shadow: 0 -1px 0 color-mix(in srgb, var(--ui-ink, #111) 8%, transparent);
  }

  .row {
    display: grid;
    grid-template-columns: 130px 1fr;
    align-items: center;
    height: 28px;
  }

  .layer {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }

  .layer::before {
    content: '';
    width: 3px;
    height: 16px;
    background: var(--c);
  }

  .lane {
    position: relative;
    height: 100%;
  }

  .clip {
    position: absolute;
    left: var(--from);
    width: var(--width);
    top: 2px;
    bottom: 2px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 8px;
    overflow: hidden;
    background: color-mix(in srgb, var(--c) 14%, var(--ui-bg, #fff));
    box-shadow: inset 3px 0 0 var(--c);
    font-size: 12px;
    white-space: nowrap;
  }

  .kind {
    font-family: var(--ui-mono, monospace);
    font-size: 10px;
    color: var(--c);
  }

  .intro {
    animation: shrink var(--loop) var(--expo) infinite;
  }

  .shift {
    animation: shift var(--loop) var(--expo) infinite;
  }

  .playhead {
    position: absolute;
    top: 10px;
    bottom: 10px;
    left: 146px;
    width: 2px;
    background: #ef4444;
    animation: head var(--loop) linear infinite;
  }

  @keyframes draft {
    0%, 4% { clip-path: inset(0 100% 0 0); opacity: 1; }
    22% { clip-path: inset(0 0 0 0); opacity: 1; }
    25%, 100% { clip-path: inset(0 0 0 0); opacity: 0; }
  }

  @keyframes mine {
    0%, 25% { opacity: 0; transform: translateY(24px); }
    30%, 100% { opacity: 1; transform: none; }
  }

  @keyframes work {
    0%, 32% { opacity: 0; height: 0; }
    36%, 50% { opacity: 1; height: 20px; }
    54%, 100% { opacity: 0; height: 0; }
  }

  @keyframes reply {
    0%, 52% { opacity: 0; transform: translateY(16px); }
    58%, 100% { opacity: 1; transform: none; }
  }

  @keyframes after {
    0%, 52% { opacity: 0; }
    58%, 96% { opacity: 1; }
    100% { opacity: 0; }
  }

  @keyframes shrink {
    0%, 52% { width: var(--width); }
    60%, 100% { width: calc(var(--width) - var(--cut)); }
  }

  @keyframes shift {
    0%, 52% { left: var(--from); }
    60%, 100% { left: calc(var(--from) - var(--cut)); }
  }

  @keyframes head {
    from { transform: translateX(0); }
    to { transform: translateX(440px); }
  }

  @keyframes pulse {
    50% { transform: scale(0.6); opacity: 0.5; }
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

    .after {
      opacity: 1;
    }

    .work {
      display: none;
    }

    .draft {
      visibility: hidden;
    }

    .intro {
      width: calc(var(--width) - var(--cut));
    }

    .shift {
      left: calc(var(--from) - var(--cut));
    }
  }
</style>
