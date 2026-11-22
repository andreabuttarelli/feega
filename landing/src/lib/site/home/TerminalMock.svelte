<script lang="ts">
  const PROMPT = 'make the hero headline bigger and use the brand orange';

  const DIFF = [
    { sign: '-', text: '  font-size: 48px;', kind: 'del' },
    { sign: '+', text: '  font-size: 80px;', kind: 'add' },
    { sign: '-', text: '  color: #ffffff;', kind: 'del' },
    { sign: '+', text: '  color: #ff5100;', kind: 'add' }
  ];
</script>

<div class="term" role="img" aria-label="Claude Code editing Hero.svelte in a terminal">
  <div class="bar">
    <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
    <span class="title">claude — landing</span>
  </div>

  <div class="body">
    <p class="user"><span class="chev">&gt;</span> {PROMPT}</p>
    <p class="note"><span class="bullet">●</span> I'll update the headline styles in the hero.</p>
    <p class="tool"><span class="bullet ok">●</span> Update(src/lib/site/home/Hero.svelte)</p>
    <p class="meta">⎿ Updated with 2 additions and 2 removals</p>
    <div class="diff">
      {#each DIFF as line (line.text)}
        <p class={line.kind}><span class="sign">{line.sign}</span>{line.text}</p>
      {/each}
    </div>
    <p class="status"><span class="spin">✻</span> Done… (3s · esc to interrupt)</p>
  </div>

  <div class="input"><span class="chev">&gt;</span><span class="caret"></span></div>
</div>

<style>
  .term {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    background: #121212;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55);
    font: 13px/1.55 ui-monospace, 'SF Mono', Menlo, monospace;
    color: #d8d8d8;
    overflow: hidden;
    text-align: left;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #1d1d1d;
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .r { background: #ff5f57; }
  .y { background: #febc2e; }
  .g { background: #28c840; }

  .title {
    flex: 1;
    margin-right: 44px;
    text-align: center;
    color: #8a8a8a;
    font-size: 12px;
  }

  .body {
    flex: 1;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
  }

  p {
    margin: 0;
    white-space: pre;
  }

  .chev, .bullet { color: #ff5100; margin-right: 6px; }
  .bullet.ok { color: #28c840; }
  .meta { color: #8a8a8a; padding-left: 4px; }
  .status { color: #ff5100; margin-top: 4px; }

  .diff {
    padding: 6px 0;
    border-left: 2px solid rgba(255, 255, 255, 0.12);
  }

  .add { background: rgba(40, 200, 64, 0.16); color: #7ee08e; }
  .del { background: rgba(255, 70, 70, 0.16); color: #ff8f8f; }
  .sign { display: inline-block; width: 22px; text-align: center; }

  .input {
    margin: 0 16px 16px;
    padding: 10px 12px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 6px;
  }

  .caret {
    display: inline-block;
    width: 8px;
    height: 15px;
    vertical-align: middle;
    background: #d8d8d8;
  }
</style>
