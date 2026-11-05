<script lang="ts">
  import '$lib/site/landing/landing.css';
  import '$lib/site/compare/compare.css';
  import { BLOG_INDEX, BLOG_PATH, COMPARISONS, comparisonPath } from '$lib/site/compare';
  import { breadcrumbJsonLd } from '$lib/site/structured-data';
</script>

<svelte:head>
  <title>{BLOG_INDEX.title}</title>
  <meta name="description" content={BLOG_INDEX.description} />
  <meta property="og:title" content={BLOG_INDEX.title} />
  <meta property="og:description" content={BLOG_INDEX.description} />
  {@html breadcrumbJsonLd('Blog', BLOG_PATH)}
</svelte:head>

<article class="landing compare">
  <h1>{BLOG_INDEX.heading}</h1>
  <p class="intro">{@html BLOG_INDEX.intro}</p>

  {#each Object.entries(COMPARISONS) as [slug, page] (slug)}
    <section>
      <h2><a href={comparisonPath(slug)}>{page.heading}</a></h2>
      <p>{page.description}</p>
    </section>
  {/each}
</article>
