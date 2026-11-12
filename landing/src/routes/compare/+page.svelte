<script lang="ts">
  import '$lib/site/landing/landing.css';
  import '$lib/site/compare/compare.css';
  import { COMPARE_INDEX, COMPARE_PATH, COMPARISONS, comparisonPath } from '$lib/site/compare';
  import { breadcrumbJsonLd } from '$lib/site/structured-data';
</script>

<svelte:head>
  <title>{COMPARE_INDEX.title}</title>
  <meta name="description" content={COMPARE_INDEX.description} />
  <meta property="og:title" content={COMPARE_INDEX.title} />
  <meta property="og:description" content={COMPARE_INDEX.description} />
  {@html breadcrumbJsonLd('Compare', COMPARE_PATH)}
</svelte:head>

<article class="landing compare">
  <h1>{COMPARE_INDEX.heading}</h1>
  <p class="intro">{@html COMPARE_INDEX.intro}</p>

  {#each Object.entries(COMPARISONS) as [slug, page] (slug)}
    <section>
      <h2><a href={comparisonPath(slug)}>{page.heading}</a></h2>
      <p>{page.description}</p>
    </section>
  {/each}
</article>
