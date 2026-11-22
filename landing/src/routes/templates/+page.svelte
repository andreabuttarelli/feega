<script lang="ts">
  import { lower } from '$lib/site/lower';
  import { AUTHOR } from '$lib/site/alternatives';
  import Faq from '$lib/site/alternatives/Faq.svelte';
  import CtaBlock from '$lib/site/alternatives/CtaBlock.svelte';
  import { DOWNLOAD_PATH } from '$lib/site/links';
  import { faqJsonLd } from '$lib/site/structured-data';
  import Gallery from '$lib/site/templates/Gallery.svelte';
  import TemplatesHero from '$lib/site/templates/TemplatesHero.svelte';
  import TemplatesLayout from '$lib/site/templates/TemplatesLayout.svelte';
  import { CATEGORY_COPY, FRAMEWORK_COPY, HUB_COPY } from '$lib/site/templates/copy';
  import { collectionJsonLd } from '$lib/site/templates/jsonld';
  import { TEMPLATES } from '$lib/site/templates/library';
  import { HUB_META } from '$lib/site/templates/meta';
  import { TEMPLATES_HEADING } from '$lib/site/templates';
  import { CATEGORY_SLUGS, HUB_FRAMEWORKS, TEMPLATES_PATH, categoryPath, frameworkPath, templatePath } from '$lib/site/templates/paths';
  import type { Category } from '$lib/site/templates/template';

  const categories = Object.keys(CATEGORY_SLUGS) as Category[];
</script>

<svelte:head>
  <title>{HUB_META.title}</title>
  <meta name="description" content={HUB_META.description} />
  <meta property="og:title" content={HUB_META.title} />
  <meta property="og:description" content={HUB_META.description} />
  {@html collectionJsonLd(
    { name: TEMPLATES_HEADING, description: HUB_META.description, path: TEMPLATES_PATH },
    TEMPLATES.map((t) => ({ name: t.name, path: templatePath(t.id) }))
  )}
  {@html faqJsonLd(HUB_COPY.faq)}
</svelte:head>

<TemplatesLayout>
  <TemplatesHero>
  <h1>{lower(TEMPLATES_HEADING)}</h1>
  <p class="fine">By {AUTHOR.name}, {AUTHOR.role}</p>
  <p class="intro lede">{HUB_COPY.lead}</p>
  </TemplatesHero>

  <Gallery templates={TEMPLATES} />

  <section>
    <h2>{lower('How the library works')}</h2>
    <div class="body">
      {#each HUB_COPY.paragraphs as paragraph (paragraph)}<p>{paragraph}</p>{/each}
    </div>
    <ul>
      {#each categories as c (c)}
        <li><a href={categoryPath(c)}>{CATEGORY_COPY[c].heading}</a>: {CATEGORY_COPY[c].lead}</li>
      {/each}
      {#each HUB_FRAMEWORKS as f (f)}
        <li><a href={frameworkPath(f)}>{FRAMEWORK_COPY[f].heading}</a></li>
      {/each}
    </ul>
  </section>

  <section>
    <h2>{lower('Questions')}</h2>
    <Faq items={HUB_COPY.faq} />
  </section>

  <CtaBlock item={{ text: 'Once an item is in your project it is a normal component. Feega lets you click it in the running app and edit it like in Figma, with the change written to your code.', label: 'get Feega, it is free', href: DOWNLOAD_PATH }} />
</TemplatesLayout>
