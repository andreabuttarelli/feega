<script lang="ts">
  const cta = primaryCta();
  import '$lib/site/landing/landing.css';
  import '$lib/site/alternatives/alternatives.css';
  import { primaryCta } from '$lib/site/install';
  import { ALTERNATIVES, ALTERNATIVES_PATH, AUTHOR, DISCLAIMER, TRY_STEPS, alternativePath } from '$lib/site/alternatives';
  import { articleJsonLd, faqJsonLd } from '$lib/site/structured-data';
  import CatalogLayout from '$lib/site/catalog/CatalogLayout.svelte';
  import { articleOutline } from '$lib/site/catalog/outline';
  import { slugify } from '$lib/site/catalog/slug';
  import Callout from '$lib/site/alternatives/Callout.svelte';
  import CtaBlock from '$lib/site/alternatives/CtaBlock.svelte';
  import Figure from '$lib/site/alternatives/Figure.svelte';
  import Table from '$lib/site/alternatives/Table.svelte';
  import Takeaways from '$lib/site/alternatives/Takeaways.svelte';
  import Faq from '$lib/site/alternatives/Faq.svelte';
  import HighlightBlock from '$lib/site/alternatives/HighlightBlock.svelte';
  import Split from '$lib/site/alternatives/Split.svelte';
  import Steps from '$lib/site/alternatives/Steps.svelte';
  import Verdict from '$lib/site/alternatives/Verdict.svelte';
  import { lower } from '$lib/site/lower';
  import { SEE_IT_LABEL, altLandingPath, landingFor } from '$lib/site/alt-landings';
  import AsciiCover from '$lib/site/alternatives/AsciiCover.svelte';
  import { coverFor } from '$lib/site/alternatives/cover';

  let { data } = $props();

  const page = $derived(data.page);
  const outline = $derived(articleOutline(page));
  const landing = $derived(landingFor(data.slug));
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

<CatalogLayout path={alternativePath(data.slug)} {outline}>
<article class="landing compare">
  <a class="back" href={ALTERNATIVES_PATH}>← All alternatives</a>
  <h1>{page.heading}</h1>
  <p class="fine">By {AUTHOR.name}, {AUTHOR.role} · checked {page.checked} · <a href="#how-we-checked">how we checked</a></p>
  <AsciiCover cover={coverFor(Object.keys(ALTERNATIVES).indexOf(data.slug))} label={page.heading} />
  <p class="intro"><strong>{page.lead}</strong></p>
  {#if landing}<p class="fine"><a href={altLandingPath(landing.slug)}>{SEE_IT_LABEL} →</a> The short version of this comparison, for {landing.agent} users.</p>{/if}

  {#if page.rich?.takeaways}<Takeaways items={page.rich.takeaways} />{/if}

  {#if page.rich}
    <Verdict text={page.rich.verdict} />
    {#if page.rich.hero}<Figure shot={page.rich.hero} />{/if}
    <section>
      <h2 id={slugify(page.rich.snapshotHeading)}>{lower(page.rich.snapshotHeading)}</h2>
      <div class="body">{@html page.rich.snapshot}</div>
    </section>
    {#each page.rich.tables ?? [] as block (block.heading)}<Table {block} />{/each}
    {#each page.rich.highlights as item, i (item.heading)}
      <HighlightBlock {item} flip={i % 2 === 1} />
    {/each}
  {/if}

  <section>
    <h2 id={slugify('When to choose which')}>{lower('When to choose which')}</h2>
    <Split themName={page.pickThem.name} them={page.pickThem.points} us={page.pickFeega} />
  </section>

  {#if page.rich}
    <section>
      <h2 id={slugify(page.rich.cost.heading)}>{lower(page.rich.cost.heading)}</h2>
      <div class="body">{#each page.rich.cost.paragraphs as p (p)}<p>{p}</p>{/each}</div>
    </section>
  {/if}

  {#each page.sections as section (section.heading)}
    <section>
      <h2 id={slugify(section.heading)}>{lower(section.heading)}</h2>
      <div class="body">{@html section.html}</div>
      {#if section.image}<Figure shot={section.image} />{/if}
      {#if section.callout}<Callout item={section.callout} />{/if}
      {#if section.cta}<CtaBlock item={section.cta} />{/if}
    </section>
  {/each}

  <section>
    <h2 id={slugify(page.rich?.stepsHeading ?? 'Try it in 2 minutes')}>{lower(page.rich?.stepsHeading ?? 'Try it in 2 minutes')}</h2>
    {#if page.rich}
      <Steps steps={page.rich.steps} />
    {:else}
      <ol>
        {#each TRY_STEPS as step (step)}<li>{step}</li>{/each}
      </ol>
    {/if}
  </section>

  <section>
    <h2 id={slugify('Mistakes people make')}>{lower('Mistakes people make')}</h2>
    {#each page.mistakes as m (m.q)}<p><strong>{m.q}</strong> {m.a}</p>{/each}
  </section>

  <section>
    <h2 id={slugify('Questions')}>{lower('Questions')}</h2>
    <Faq items={page.questions} />
  </section>

  <section>
    <h2 id={slugify('How we checked')}>{lower('How we checked')}</h2>
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

  <section class="closing">
    <p>{page.rich?.closing ?? page.hook}</p>
    <a class="landing-cta" href={cta.href}>{cta.label} →</a>
  </section>

  <section>
    <h2 id={slugify('Read next')}>{lower('Read next')}</h2>
    <ul>
      {#each others as [slug, other] (slug)}<li><a href={alternativePath(slug)}>{other.heading}</a></li>{/each}
    </ul>
  </section>
</article>
</CatalogLayout>
