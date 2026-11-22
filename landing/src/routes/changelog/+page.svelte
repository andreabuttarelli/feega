<script lang="ts">
  import { changelogByDate, changelogPagePath, type ChangelogEntry } from '$lib/site/changelog-pages';

  const AHEAD_PX = 800;

  let { data } = $props();

  let shown = $state<ChangelogEntry[]>([]);
  let page = $state(1);
  let loading = $state(false);
  let failed = $state(false);
  let sentinel = $state<HTMLElement | null>(null);

  const days = $derived(changelogByDate([...data.entries, ...shown]));
  const more = $derived(page < data.pages);

  async function loadMore() {
    if (loading || !more) {
      return;
    }

    loading = true;
    failed = false;
    const res = await fetch(changelogPagePath(page + 1)).catch(() => null);
    if (!res?.ok) {
      loading = false;
      failed = true;
      return;
    }

    shown = [...shown, ...((await res.json()) as ChangelogEntry[])];
    page += 1;
    loading = false;
  }

  $effect(() => {
    if (!sentinel || failed || loading || !page) {
      return;
    }

    const watcher = new IntersectionObserver(([hit]) => hit.isIntersecting && void loadMore(), { rootMargin: `${AHEAD_PX}px` });
    watcher.observe(sentinel);
    return () => watcher.disconnect();
  });
</script>

<svelte:head>
  <title>Changelog — Feega</title>
  <meta name="description" content="All new features, improvements and fixes in Feega. See what changed in the product." />
  <meta property="og:title" content="Changelog — Feega" />
  <meta property="og:description" content="All new features, improvements and fixes in Feega." />
</svelte:head>

<section class="changelog">
  <header>
    <p class="eyebrow">Changelog</p>
    <h1>What changed in Feega</h1>
  </header>

  {#each days as day}
    <article>
      <h2><time datetime={day.date}>{day.date}</time></h2>
      <ul>
        {#each day.items as item}
          <li>{item}</li>
        {/each}
      </ul>
    </article>
  {/each}

  {#if more}
    <div class="more" bind:this={sentinel}>
      <button type="button" onclick={loadMore} disabled={loading}>{loading ? 'loading…' : failed ? 'try again' : 'show more'}</button>
    </div>
  {/if}
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
    text-transform: none;
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
  h2 {
    font-size: var(--site-text);
    font-weight: 500;
    margin: 0;
    opacity: 0.6;
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
  .more {
    display: flex;
    justify-content: center;
    padding: 32px 0 0;
    border-top: 1px solid var(--site-line);
  }
  .more button {
    min-height: 44px;
    padding: 0 22px;
    border: 1px solid var(--site-line);
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 15px;
    cursor: pointer;
  }
  .more button:disabled {
    opacity: 0.6;
    cursor: default;
  }
  @media (max-width: 640px) {
    article {
      grid-template-columns: 1fr;
      gap: 8px;
    }
  }
</style>
