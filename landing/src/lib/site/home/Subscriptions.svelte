<script lang="ts">
  import { DOCS_URL } from '../links';
  import { AGENT_LOGOS } from '../home';
</script>

<section class="subs site-wide">
  <h2><a href={DOCS_URL}>Use your own AI subscriptions, via MCP</a></h2>

  <div class="logos" aria-hidden="true">
    {#each AGENT_LOGOS as logo (logo.file)}
      <img src="/site/home/{logo.file}" alt="" width={logo.width} height="32" />
    {/each}
  </div>
</section>

<style>
  .subs {
    padding: 87px 20px 115px;
  }

  h2 {
    font-size: 24px;
    line-height: 28.8px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  a {
    display: inline;
  }

  .logos {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 24px;
  }

  img {
    height: 32px;
  }

  @media (min-width: 1200px) {
    .subs {
      display: grid;
      grid-template-columns: 518px 518px;
      justify-content: space-between;
      align-items: center;
      padding: 72px 0 150px;
    }

    h2 {
      font-size: 38px;
      line-height: 45.6px;
    }

    a {
      display: inline-block;
      padding: 4px 0;
    }

    .logos {
      justify-content: space-around;
      margin-top: 0;
    }
  }

  @media (min-width: 810px) and (max-width: 1199.98px) {
    .subs {
      display: grid;
      grid-template-columns: 379px 379px;
      justify-content: space-between;
      align-items: center;
      padding: 89px 0 300px;
    }

    h2 {
      font-size: 30px;
      line-height: 36px;
    }

    .logos {
      justify-content: space-around;
      margin-top: 0;
    }
  }
</style>
