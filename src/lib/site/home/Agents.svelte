<script lang="ts">
  import { AGENT_SETUPS } from '../home';

  const COPIED_MS = 1500;

  let current = $state<string>(AGENT_SETUPS[0].id);
  let copied = $state(false);

  const setup = $derived(AGENT_SETUPS.find((s) => s.id === current) ?? AGENT_SETUPS[0]);

  async function copy() {
    await navigator.clipboard.writeText(setup.code);
    copied = true;
    setTimeout(() => (copied = false), COPIED_MS);
  }
</script>

<section class="agents" id="mcp">
  <h2>Let your agents do the work</h2>

  <div class="box">
    <div class="tabs" role="tablist" aria-label="Code variants">
      {#each AGENT_SETUPS as s (s.id)}
        <button type="button" role="tab" aria-selected={s.id === current} class:is-active={s.id === current} onclick={() => (current = s.id)}>{s.label}</button>
      {/each}
    </div>
    <pre role="tabpanel"><code>{setup.code}</code></pre>
    <button type="button" class="copy" onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>
  </div>
</section>

<style>
  .agents {
    max-width: 430px;
    margin: 0 auto;
    padding: 0 12px 100px;
  }

  h2 {
    font-size: 50px;
    line-height: 0.9;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .box {
    position: relative;
    overflow: hidden;
    margin-top: 24px;
    border: 1px solid #444;
    border-radius: 10px;
    background: #000;
    font-family: sans-serif;
    letter-spacing: normal;
    font-variation-settings: normal;
  }

  .tabs {
    display: flex;
    overflow-x: auto;
    scrollbar-width: none;
    border-bottom: 1px solid #444;
  }

  .tabs button {
    flex-shrink: 0;
    font-family: inherit;
    letter-spacing: inherit;
    padding: 12px 18px;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.4;
    white-space: nowrap;
    color: #737373;
    background: none;
    border: 0;
    cursor: pointer;
  }

  .tabs button.is-active {
    color: #fff;
    box-shadow: inset 0 -2px 0 #0a0a0a;
  }

  pre {
    min-height: 262px;
    margin: 0;
    padding: 22px 20px;
    overflow-x: auto;
    background: #121212;
    color: #fff;
    font-family: 'Fragment Mono', monospace;
    font-size: 13px;
    line-height: 1.55;
  }

  .copy {
    font-family: inherit;
    letter-spacing: inherit;
    position: absolute;
    top: 55px;
    right: 12px;
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.2;
    color: #737373;
    background: #000;
    border: 1px solid #444;
    border-radius: 6px;
    cursor: pointer;
  }

  @media (min-width: 1200px) {
    .agents {
      max-width: 1500px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 24px;
      align-items: center;
      padding: 0 20px 200px;
    }

    h2 {
      font-size: 78px;
    }

    .box {
      margin-top: 0;
    }
  }
</style>
