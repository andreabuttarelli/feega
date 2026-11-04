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

<section class="agents site-wide" id="mcp">
  <h2>Let your agents do the work</h2>

  <div class="box">
    <div class="tabs" role="tablist" aria-label="Code variants">
      {#each AGENT_SETUPS as s (s.id)}
        <button type="button" role="tab" aria-selected={s.id === current} class:is-active={s.id === current} onclick={() => (current = s.id)}>{s.label}</button>
      {/each}
    </div>
    <div role="tabpanel" tabindex="0"><pre><code>{setup.code}</code></pre></div>
    <button type="button" class="copy" onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>
  </div>
</section>

<style>
  .agents {
    padding: 0 12px 100px;
    color: var(--site-ink);
  }

  h2 {
    font-size: 50px;
    line-height: 45px;
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
  }

  .tabs button {
    flex-shrink: 0;
    font-family: inherit;
    letter-spacing: inherit;
    padding: 12px 18px;
    font-size: 13px;
    font-weight: 500;
    line-height: 18.2px;
    white-space: nowrap;
    color: #737373;
    background: none;
    border: 0;
    cursor: pointer;
  }

  .tabs button.is-active {
    color: #fff;
    box-shadow: inset 0 -2px 0 #ff5100;
  }

  pre {
    min-height: 262px;
    margin: 0;
    padding: 22px 20px;
    overflow-x: auto;
    background: #4f4f4f;
    color: #fff;
    font-family: 'Fragment Mono', monospace;
    font-size: 13px;
    line-height: 20.15px;
  }

  .copy {
    font-family: inherit;
    letter-spacing: inherit;
    position: absolute;
    top: 56px;
    right: 13px;
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
      display: grid;
      grid-template-columns: 518px 518px;
      justify-content: space-between;
      align-items: center;
      padding: 0 0 200px;
    }

    h2 {
      font-size: 78px;
      line-height: 70.2px;
    }

    .box {
      margin-top: 0;
    }
  }

  @media (min-width: 810px) and (max-width: 1199.98px) {
    .agents {
      padding: 0 0 149px;
    }

    h2 {
      font-size: 62px;
      line-height: 55.8px;
    }

    .box {
      margin-top: 25px;
    }
  }
</style>
