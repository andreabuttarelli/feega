<script lang="ts">
  import { AGENT_LOGOS } from '../home';
</script>

<section class="open site-wide">
  <h2>Open source. <br />Apache-2.0.<br />Works with Claude Code, <br class="wide" />Codex, Cursor.</h2>

  <ul class="logos">
    {#each AGENT_LOGOS as logo (logo.file)}
      <li><img src="/site/home/{logo.file}" alt={logo.name} width={logo.width} height="32" /></li>
    {/each}
  </ul>
</section>

<style>
  .open {
    padding: 170px 20px 0;
    color: var(--site-ink);
  }

  h2 {
    font-size: 37px;
    line-height: 37px;
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
      padding: 170px 0 0;
    }

    .wide {
      display: inline;
    }

    h2 {
      font-size: 46px;
      line-height: 46px;
    }

    .logos {
      justify-content: space-around;
      width: 400px;
      margin: 40px auto 0;
    }
  }

  @media (min-width: 1200px) {
    h2 {
      font-size: 58px;
      line-height: 58px;
    }
  }
</style>
