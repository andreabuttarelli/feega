<script lang="ts">
  import '$lib/site/landing/landing.css';
  import '$lib/site/compare/compare.css';
  import { APP_URL } from '$lib/site/links';
  import { BLOG_PATH, COMPARISONS, comparisonPath } from '$lib/site/compare';
  import { FEEGA_FEATURES, FEEGA_PRICING } from '$lib/site/compare/feega';
  import { FEATURE_LABELS, Feature, type Verdict } from '$lib/site/compare/features';
  import { breadcrumbJsonLd } from '$lib/site/structured-data';

  let { data } = $props();

  const page = $derived(data.page);
  const others = $derived(Object.entries(COMPARISONS).filter(([slug]) => slug !== data.slug));
  const mark = (v: Verdict) => (v.has ? 'Yes' : 'No');
</script>

<svelte:head>
  <title>{page.title}</title>
  <meta name="description" content={page.description} />
  <meta property="og:title" content={page.title} />
  <meta property="og:description" content={page.description} />
  <meta name="twitter:title" content={page.title} />
  <meta name="twitter:description" content={page.description} />
  {@html breadcrumbJsonLd(page.heading, comparisonPath(data.slug))}
</svelte:head>

<article class="landing compare">
  <a class="back" href={BLOG_PATH}>← All comparisons</a>
  <h1>{page.heading}</h1>
  <p class="intro">{page.intro}</p>

  <section>
    <h2>Who should pick {page.name}</h2>
    <p>{page.pickThem}</p>
    <ul>
      {#each page.theyWin as point (point)}
        <li>{point}</li>
      {/each}
    </ul>
  </section>

  <section>
    <h2>Who should pick Feega</h2>
    <p>{page.pickFeega}</p>
    <ul>
      {#each page.feegaWins as point (point)}
        <li>{point}</li>
      {/each}
    </ul>
  </section>

  <section>
    <h2>Feature by feature</h2>
    <div class="table">
      <table>
        <thead>
          <tr><th></th><th>Feega</th><th>{page.name}</th></tr>
        </thead>
        <tbody>
          {#each Object.values(Feature) as key (key)}
            <tr>
              <th scope="row">{FEATURE_LABELS[key]}</th>
              {#each [FEEGA_FEATURES[key], page.features[key]] as verdict, i (i)}
                <td class:yes={verdict.has}>
                  {mark(verdict)}
                  {#if verdict.note}<small>{verdict.note}</small>{/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  {#each page.sections as section (section.heading)}
    <section>
      <h2>{section.heading}</h2>
      <div class="body">{@html section.html}</div>
    </section>
  {/each}

  <section>
    <h2>Pricing</h2>
    <div class="body">
      <p><strong>{page.name}:</strong> {page.pricing}</p>
      <p><strong>Feega:</strong> {FEEGA_PRICING}</p>
    </div>
  </section>

  <section>
    <h2>Sources</h2>
    <p class="fine">Checked on {page.checked}. Something wrong? Write to <a href="mailto:hi@feega.app">hi@feega.app</a>.</p>
    <ul>
      {#each page.sources as source (source.href)}
        <li><a href={source.href} rel="noopener">{source.label}</a></li>
      {/each}
    </ul>
  </section>

  <section>
    <h2>More comparisons</h2>
    <ul>
      {#each others as [slug, other] (slug)}
        <li><a href={comparisonPath(slug)}>{other.heading}</a></li>
      {/each}
    </ul>
    <a class="landing-cta" href={APP_URL}>Try Feega →</a>
  </section>
</article>
