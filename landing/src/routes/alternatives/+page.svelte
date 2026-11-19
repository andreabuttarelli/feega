<script lang="ts">
  import '$lib/site/landing/landing.css';
  import '$lib/site/compare/compare.css';
  import { ALTERNATIVES, ALTERNATIVES_INDEX, ALTERNATIVES_PATH, KIND_HEADINGS, alternativePath } from '$lib/site/alternatives';
  import { ArticleKind } from '$lib/site/alternatives/alternative';
  import { COMPARISONS, comparisonPath } from '$lib/site/compare';
  import { breadcrumbJsonLd } from '$lib/site/structured-data';
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
  {@html breadcrumbJsonLd('Alternatives', ALTERNATIVES_PATH)}
</svelte:head>

<article class="landing compare">
  <h1>{ALTERNATIVES_INDEX.heading}</h1>
  <p class="intro">{ALTERNATIVES_INDEX.intro}</p>

  {#each Object.values(ArticleKind) as kind (kind)}
    <h2>{KIND_HEADINGS[kind]}</h2>
    <div class="cards">
      {#each ofKind(kind) as [slug, article] (slug)}
        <a class="card" href={alternativePath(slug)}>
          <AsciiCover cover={coverFor(slugs.indexOf(slug))} label={article.heading} logo={article.logo} />
          <strong>{article.heading}</strong>
          <span>{article.hook}</span>
        </a>
      {/each}
    </div>
  {/each}

  <section>
    <h2>One on one</h2>
    <ul>
      {#each Object.entries(COMPARISONS) as [slug, page] (slug)}
        <li><a href={comparisonPath(slug)}>{page.heading}</a></li>
      {/each}
    </ul>
  </section>
</article>
