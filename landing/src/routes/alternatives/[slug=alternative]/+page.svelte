<script lang="ts">
  import '$lib/site/landing/landing.css';
  import '$lib/site/compare/compare.css';
  import { APP_URL } from '$lib/site/links';
  import { ALTERNATIVES, ALTERNATIVES_PATH, AUTHOR, DISCLAIMER, TRY_STEPS, alternativePath } from '$lib/site/alternatives';
  import { articleJsonLd, faqJsonLd } from '$lib/site/structured-data';
  import AsciiCover from '$lib/site/alternatives/AsciiCover.svelte';
  import { coverFor } from '$lib/site/alternatives/cover';

  let { data } = $props();

  const page = $derived(data.page);
  const others = $derived(Object.entries(ALTERNATIVES).filter(([slug]) => slug !== data.slug).slice(0, 6));
</script>

<svelte:head>
  <title>{page.title}</title>
  <meta name="description" content={page.description} />
  <meta property="og:title" content={page.title} />
  <meta property="og:description" content={page.description} />
  {@html articleJsonLd({ title: page.title, description: page.description, path: alternativePath(data.slug), checked: page.checked })}
  {@html faqJsonLd(page.questions)}
</svelte:head>

<article class="landing compare">
  <a class="back" href={ALTERNATIVES_PATH}>← All alternatives</a>
  <h1>{page.heading}</h1>
  <p class="fine">By {AUTHOR.name}, {AUTHOR.role} · checked {page.checked} · <a href="#how-checked">how we checked</a></p>
  <AsciiCover cover={coverFor(Object.keys(ALTERNATIVES).indexOf(data.slug))} label={page.heading} logo={page.logo} />
  <p class="intro"><strong>{page.lead}</strong></p>

  <section>
    <h2>The short version</h2>
    <h3>Pick {page.pickThem.name} if</h3>
    <ul>
      {#each page.pickThem.points as point (point)}<li>{point}</li>{/each}
    </ul>
    <h3>Pick Feega if</h3>
    <ul>
      {#each page.pickFeega as point (point)}<li>{point}</li>{/each}
    </ul>
  </section>

  {#each page.sections as section (section.heading)}
    <section>
      <h2>{section.heading}</h2>
      <div class="body">{@html section.html}</div>
    </section>
  {/each}

  <section>
    <h2>Try it in 2 minutes</h2>
    <ol>
      {#each TRY_STEPS as step (step)}<li>{step}</li>{/each}
    </ol>
  </section>

  <section>
    <h2>Mistakes people make</h2>
    {#each page.mistakes as m (m.q)}<p><strong>{m.q}</strong> {m.a}</p>{/each}
  </section>

  <section>
    <h2>Questions</h2>
    {#each page.questions as item (item.q)}
      <h3>{item.q}</h3>
      <p>{item.a}</p>
    {/each}
  </section>

  <section id="how-checked">
    <h2>How we checked</h2>
    <p class="fine">
      We make Feega, so read our column with that in mind. We read each product's public pages on {page.checked} and compared what they offer, not finished work.
      Something wrong? Write to <a href="mailto:hi@feega.app">hi@feega.app</a>.
    </p>
    <ol>
      {#each page.sources as source (source.href)}
        <li><a href={source.href} rel="noopener">{source.label}</a></li>
      {/each}
    </ol>
    <p class="fine">{DISCLAIMER}</p>
  </section>

  <section>
    <h2>Read next</h2>
    <ul>
      {#each others as [slug, other] (slug)}<li><a href={alternativePath(slug)}>{other.heading}</a></li>{/each}
    </ul>
    <a class="landing-cta" href={APP_URL}>Try Feega →</a>
  </section>
</article>
