<script lang="ts">
  import entries from 'virtual:changelog-entries';
</script>

<svelte:head>
  <title>Changelog — feega</title>
  <meta name="description" content="All new features, improvements and fixes in feega. See what changed in the product." />
  <meta property="og:title" content="Changelog — feega" />
  <meta property="og:description" content="All new features, improvements and fixes in feega." />
</svelte:head>

<section class="changelog">
  <header>
    <p class="eyebrow">Changelog</p>
    <h1>What changed in feega</h1>
  </header>

  {#each entries as entry}
    <article>
      <time datetime={entry.date}>{entry.date}</time>
      <div>
        <h2>{entry.title}</h2>
        <ul>
          {#each entry.items as item}
            <li>{item}</li>
          {/each}
        </ul>
      </div>
    </article>
  {/each}
</section>

<style>
  .changelog {
    max-width: 880px;
    margin: 0 auto;
    padding: 120px var(--site-gutter) 96px;
    color: var(--site-ink);
  }
  header {
    margin-bottom: 56px;
  }
  .eyebrow {
    color: var(--site-accent);
    font-size: var(--site-text);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 12px;
  }
  h1 {
    font-size: clamp(36px, 6vw, 64px);
    line-height: 0.95;
    letter-spacing: -0.04em;
    margin: 0;
  }
  article {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 24px;
    padding: 28px 0;
    border-top: 1px solid var(--site-line);
  }
  time {
    font-size: var(--site-text);
    opacity: 0.6;
  }
  h2 {
    font-size: 20px;
    margin: 0 0 12px;
  }
  ul {
    margin: 0;
    padding-left: 18px;
    display: grid;
    gap: 8px;
    font-size: 15px;
    line-height: 1.6;
    opacity: 0.8;
  }
  @media (max-width: 640px) {
    article {
      grid-template-columns: 1fr;
      gap: 8px;
    }
  }
</style>
