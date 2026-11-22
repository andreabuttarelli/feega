<script lang="ts">
  import '$lib/site/landing/landing.css';
  import '$lib/site/alternatives/alternatives.css';
  import CatalogLayout from '$lib/site/catalog/CatalogLayout.svelte';
  import { ALTERNATIVES, ALTERNATIVES_INDEX, ALTERNATIVES_PATH, AUTHOR, DISCLAIMER, KIND_HEADINGS, alternativePath } from '$lib/site/alternatives';
  import { ArticleKind } from '$lib/site/alternatives/alternative';
  import AsciiCover from '$lib/site/alternatives/AsciiCover.svelte';
  import { coverFor } from '$lib/site/alternatives/cover';

  const slugs = Object.keys(ALTERNATIVES);

  const ofKind = (kind: ArticleKind) => Object.entries(ALTERNATIVES).filter(([, a]) => a.kind === kind);
</script>

<svelte:head>
  <title>{ALTERNATIVES_INDEX.title}</title>
  <meta name="description" content={ALTERNATIVES_INDEX.description} />
  <meta property="og:title" content={ALTERNATIVES_INDEX.title} />
  <meta property="og:description" content={ALTERNATIVES_INDEX.description} />
</svelte:head>

<CatalogLayout path={ALTERNATIVES_PATH}>
<article class="landing compare">
  <h1>{ALTERNATIVES_INDEX.heading}</h1>
  <p class="fine">By {AUTHOR.name}, {AUTHOR.role}</p>
  <p class="intro">{ALTERNATIVES_INDEX.intro}</p>

  {#each Object.values(ArticleKind) as kind (kind)}
    <h2>{KIND_HEADINGS[kind]}</h2>
    <div class="cards">
      {#each ofKind(kind) as [slug, article] (slug)}
        <a class="card" href={alternativePath(slug)}>
          <AsciiCover cover={coverFor(slugs.indexOf(slug))} label={article.heading} />
          <strong>{article.heading}</strong>
          <span>{article.hook}</span>
        </a>
      {/each}
    </div>
  {/each}

  <p class="fine"><a href="/templates">Free sections and UI templates for Svelte, React, Vue and Astro</a></p>
  <p class="fine">{DISCLAIMER}</p>
</article>
</CatalogLayout>
