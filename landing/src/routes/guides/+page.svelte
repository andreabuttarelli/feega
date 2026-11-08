<script lang="ts">
  import '$lib/site/landing/landing.css';
  import '$lib/site/compare/compare.css';
  import { GUIDES, GUIDES_INDEX, GUIDES_PATH, guidePath } from '$lib/site/guides';
  import { breadcrumbJsonLd } from '$lib/site/structured-data';
</script>

<svelte:head>
  <title>{GUIDES_INDEX.title}</title>
  <meta name="description" content={GUIDES_INDEX.description} />
  <meta property="og:title" content={GUIDES_INDEX.title} />
  <meta property="og:description" content={GUIDES_INDEX.description} />
  {@html breadcrumbJsonLd('Guides', GUIDES_PATH)}
</svelte:head>

<article class="landing compare">
  <h1>{GUIDES_INDEX.heading}</h1>
  <p class="intro">{GUIDES_INDEX.intro}</p>

  {#each Object.entries(GUIDES) as [slug, guide] (slug)}
    <section>
      <h2><a href={guidePath(slug)}>{guide.heading}</a></h2>
      <p>{guide.description}</p>
    </section>
  {/each}
</article>
