<script lang="ts">
  import { AGENT_LOGOS } from '../home';
</script>

<section class="open site-wide">
  <h2 data-agent-id="open-title">Open source. <br />Apache-2.0.<br />Works with Claude Code, <br class="wide" />Codex, Cursor.</h2>

  <ul class="logos" data-agent-id="open-logos">
    {#each AGENT_LOGOS as logo (logo.file)}
      <li><img src="/site/home/{logo.file}" alt={logo.name} width={logo.width} height="32" /></li>
    {/each}
  </ul>
</section>

<style>
  .open {
    padding: var(--site-section) 20px 0;
    color: var(--site-ink);
  }

  h2 {
    font-size: 24px;
    line-height: 28.8px;
    letter-spacing: -0.04em;
    font-weight: 400;
    text-align: center;
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }

  .wide {
    display: none;
  }

  .logos {
    display: flex;
    justify-content: space-between;
    margin: 40px 0 0;
    padding: 0;
    list-style: none;
  }

  @media (min-width: 810px) {
    .open {
      padding: var(--site-section) 0 0;
    }

    .wide {
      display: inline;
    }

    h2 {
      font-size: 30px;
      line-height: 36px;
    }

    .logos {
      justify-content: space-around;
      width: 400px;
      margin: 40px auto 0;
    }
  }

  @media (min-width: 1200px) {
    h2 {
      font-size: 38px;
      line-height: 45.6px;
    }
  }
</style>
