<script lang="ts">
  const FACTS = ['€0, forever', 'every edit a diff', 'no AI, no tokens'] as const;
</script>

<section class="free site-wide" aria-labelledby="free-title">
  <h2 id="free-title" data-agent-id="free-title">
    <span class="lead">the Feega extension is</span>
    <span class="word site-display">free</span>
  </h2>

  <ul class="facts">
    {#each FACTS as fact (fact)}<li>{fact}</li>{/each}
  </ul>

  <a class="templates" href="/templates">free sections and UI templates for Svelte, React, Vue and Astro →</a>
</section>

<style>
  .templates {
    color: var(--site-ink);
    font-size: 16px;
    text-decoration: underline;
    text-underline-offset: 4px;
  }

  .free {
    display: grid;
    justify-items: center;
    gap: 24px;
    padding: var(--site-section) 12px 0;
    color: var(--site-ink);
    text-align: center;
  }

  h2 {
    display: grid;
    justify-items: center;
    gap: 8px;
    margin: 0;
  }

  .lead {
    font-size: 22px;
    line-height: 26px;
    letter-spacing: -0.04em;
  }

  .word {
    font-size: clamp(180px, 46vw, 520px);
    padding-bottom: 0.08em;
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px 32px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .facts li {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .facts li::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: var(--ui-radius-xs, 2px);
    background: #ff5100;
  }

  @media (min-width: 810px) {
    .free {
      padding: var(--site-section) 0 0;
    }

    .lead {
      font-size: 34px;
      line-height: 38px;
    }
  }
</style>
