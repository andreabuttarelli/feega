<script lang="ts">
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import Play from '@lucide/svelte/icons/play';
  import TourFilm from '../../TourFilm.svelte';

  const ASK = 'Shorter intro, in our blue';

  const TRACKS = [
    { kind: 'TITLE', name: 'ship it.', color: '#4f46e5', from: 0, to: 34 },
    { kind: 'UI', name: 'Revenue', color: '#db2777', from: 34, to: 70 },
    { kind: 'LOGO', name: 'acme', color: '#16a34a', from: 70, to: 100 },
    { kind: 'AUDIO', name: 'Launch · 120 bpm', color: '#d97706', from: 0, to: 100 }
  ];
</script>

<div class="scene">
  <div class="phone">
    <header class="top">
      <ArrowLeft size={18} strokeWidth={1.8} />
      <b>Launch film</b>
      <span class="export">Export</span>
    </header>

    <div class="preview">
      <div class="screen">
        <TourFilm />
        <div class="after"><TourFilm accent="#0099ff" /></div>
      </div>
    </div>

    <div class="transport">
      <Play size={14} strokeWidth={1.8} />
      <span class="mono">00:04 / 00:24</span>
    </div>

    <section class="timeline">
      {#each TRACKS as track (track.kind)}
        <span class="lane">
          <span class="clip" class:intro={track.kind === 'TITLE'} class:shift={track.kind === 'UI' || track.kind === 'LOGO'} style:--c={track.color} style:--from="{track.from}%" style:--width="{track.to - track.from}%">
            {track.name}
          </span>
        </span>
      {/each}
      <span class="playhead"></span>
    </section>

    <div class="chat">
      <p class="mine">{ASK}</p>
      <p class="work"><span class="spin"></span>Editing 3 clips</p>
      <p class="reply">Done. Intro is 1.2 s, title in <span class="swatch"></span><span class="mono">#0099ff</span>.</p>
    </div>

    <div class="ask">
      <span class="draft">{ASK}</span>
      <span class="send"><ArrowUp size={16} strokeWidth={2} /></span>
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

  .phone {
    position: absolute;
    inset: 68px 12px 12px;
    display: flex;
    flex-direction: column;
    background: var(--ui-bg, #fff);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-ink, #111) 8%, transparent), 0 40px 80px -40px rgba(0, 0, 0, 0.45);
  }

  .top {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding-left: 12px;
    font-size: 15px;
  }

  .top b {
    font-weight: 600;
  }

  .export {
    display: flex;
    align-items: center;
    align-self: stretch;
    margin-left: auto;
    padding: 0 18px;
    background: var(--ui-accent, #0099ff);
    color: #fff;
    font-size: 14px;
    font-weight: 600;
  }

  .preview {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    container-type: size;
    background: var(--ui-surface, #fafaf8);
  }

  .screen {
    position: relative;
    width: min(100cqw, 100cqh * 16 / 9);
  }

  .after {
    position: absolute;
    inset: 0;
    opacity: 0;
    animation: after var(--loop) var(--expo) infinite;
  }

  .transport {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 32px;
  }

  .mono {
    font-family: var(--ui-mono, monospace);
    font-size: 12px;
  }

  .timeline {
    --cut: 13.6%;
    position: relative;
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 6px 12px 10px;
    box-shadow: 0 -1px 0 color-mix(in srgb, var(--ui-ink, #111) 8%, transparent);
  }

  .lane {
    position: relative;
    height: 20px;
  }

  .clip {
    position: absolute;
    left: var(--from);
    width: var(--width);
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    padding: 0 7px;
    overflow: hidden;
    background: color-mix(in srgb, var(--c) 14%, var(--ui-bg, #fff));
    box-shadow: inset 3px 0 0 var(--c);
    font-size: 12px;
    white-space: nowrap;
  }

  .intro {
    animation: shrink var(--loop) var(--expo) infinite;
  }

  .shift {
    animation: shift var(--loop) var(--expo) infinite;
  }

  .playhead {
    position: absolute;
    top: 2px;
    bottom: 6px;
    left: 12px;
    width: 2px;
    background: #ef4444;
    animation: head var(--loop) linear infinite;
  }

  .chat {
    flex: none;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 8px;
    height: 96px;
    padding: 0 12px 8px;
    overflow: hidden;
    font-size: 14px;
    box-shadow: 0 -1px 0 color-mix(in srgb, var(--ui-ink, #111) 8%, transparent);
  }

  .chat p {
    margin: 0;
    line-height: 1.35;
  }

  .mine {
    align-self: flex-end;
    padding: 8px 12px;
    background: var(--ui-hover, #f2f2ef);
    animation: mine var(--loop) var(--expo) infinite;
  }

  .work {
    display: flex;
    align-items: center;
    gap: 8px;
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
    margin: 0 4px 0 2px;
    border-radius: 50%;
    background: #0099ff;
  }

  .ask {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 48px;
    margin: 0 8px 8px;
    padding: 0 6px 0 12px;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-ink, #111) 14%, transparent);
    font-size: 14px;
  }

  .draft {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    clip-path: inset(0 100% 0 0);
    animation: draft var(--loop) steps(14, end) infinite;
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
    36%, 50% { opacity: 1; height: 19px; }
    54%, 100% { opacity: 0; height: 0; }
  }

  @keyframes reply {
    0%, 52% { opacity: 0; transform: translateY(16px); }
    58%, 100% { opacity: 1; transform: none; }
  }

  @keyframes after {
    0%, 52% { opacity: 0; }
    58%, 100% { opacity: 1; }
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
    from { left: 12px; }
    to { left: calc(100% - 14px); }
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
