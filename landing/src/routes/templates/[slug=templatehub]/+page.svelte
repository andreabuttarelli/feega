<script lang="ts">
  import { lower } from '$lib/site/lower';
  import { AUTHOR } from '$lib/site/alternatives';
  import Faq from '$lib/site/alternatives/Faq.svelte';
  import CtaBlock from '$lib/site/alternatives/CtaBlock.svelte';
  import { DOWNLOAD_PATH } from '$lib/site/links';
  import { faqJsonLd } from '$lib/site/structured-data';
  import Gallery from '$lib/site/templates/Gallery.svelte';
  import TemplatesLayout from '$lib/site/templates/TemplatesLayout.svelte';
  import { CATEGORY_COPY, FRAMEWORK_COPY } from '$lib/site/templates/copy';
  import { collectionJsonLd } from '$lib/site/templates/jsonld';
  import { TEMPLATES } from '$lib/site/templates/library';
  import { categoryMeta, frameworkMeta } from '$lib/site/templates/meta';
  import { TEMPLATES_HEADING } from '$lib/site/templates';
  import { CATEGORY_SLUGS, HUB_FRAMEWORKS, TEMPLATES_PATH, TOKENS_PATH, categoryPath, frameworkPath, templatePath } from '$lib/site/templates/paths';
  import { Filters, type Category } from '$lib/site/templates/template';

  let { data } = $props();

  const category = $derived(data.category);
  const framework = $derived(data.framework);
  const copy = $derived(category ? CATEGORY_COPY[category] : FRAMEWORK_COPY[framework!]);
  const meta = $derived(category ? categoryMeta(category) : frameworkMeta(framework!));
  const path = $derived(category ? categoryPath(category) : frameworkPath(framework!));
  const items = $derived(category ? TEMPLATES.filter((t) => t.category === category) : TEMPLATES);
  const otherCategories = $derived((Object.keys(CATEGORY_SLUGS) as Category[]).filter((c) => c !== category));
  const frameworkSections = $derived(framework ? FRAMEWORK_COPY[framework].sections : []);
  const categoryParagraphs = $derived(category ? CATEGORY_COPY[category].paragraphs : []);
</script>

<svelte:head>
  <title>{meta.title}</title>
  <meta name="description" content={meta.description} />
  <meta property="og:title" content={meta.title} />
  <meta property="og:description" content={meta.description} />
  {@html collectionJsonLd(
    { name: copy.heading, description: meta.description, path },
    items.map((t) => ({ name: t.name, path: templatePath(t.id) }))
  )}
  {@html faqJsonLd(copy.faq)}
</svelte:head>

<TemplatesLayout>
  <p class="crumbs"><a href={TEMPLATES_PATH}>{lower(TEMPLATES_HEADING)}</a> <span>/</span> <span>{lower(category ? CATEGORY_COPY[category].label : FRAMEWORK_COPY[framework!].label)}</span></p>
  <h1>{lower(copy.heading)}</h1>
  <p class="fine">By {AUTHOR.name}, {AUTHOR.role}</p>
  <p class="intro lede">{copy.lead}</p>

  {#if framework}
    {@const guides = FRAMEWORK_COPY[framework].guides}
    {#if guides.length}
      <p class="fine hubs">
        {#each guides as guide (guide.path)}<a href={guide.path}>{lower(guide.label)} →</a>{/each}
      </p>
    {/if}
  {/if}

  <Gallery templates={items} filters={framework ? Filters.Full : Filters.Tags} {framework} />

  {#each categoryParagraphs as paragraph (paragraph)}
    <div class="body"><p>{paragraph}</p></div>
  {/each}

  {#each frameworkSections as section (section.heading)}
    <section>
      <h2>{lower(section.heading)}</h2>
      <div class="body">
        {#each section.paragraphs as paragraph (paragraph)}<p>{paragraph}</p>{/each}
      </div>
    </section>
  {/each}

  {#if framework}
    <p class="fine"><a href={TOKENS_PATH}>tokens.css</a> is the shared file every item reads.</p>
  {/if}

  <section>
    <h2>{lower('Questions')}</h2>
    <Faq items={copy.faq} />
  </section>

  <section>
    <h2>{lower('More templates')}</h2>
    <p class="hubs">
      {#each otherCategories as c (c)}<a href={categoryPath(c)}>{lower(CATEGORY_COPY[c].label)} →</a>{/each}
      {#each HUB_FRAMEWORKS.filter((f) => f !== framework) as f (f)}<a href={frameworkPath(f)}>{lower(FRAMEWORK_COPY[f].label)} →</a>{/each}
      <a href={TEMPLATES_PATH}>{lower('All templates')} →</a>
    </p>
  </section>

  <CtaBlock item={{ text: 'Feega edits these components in your running app and writes the change to your code. Free, with diffs and undo.', label: 'get Feega, it is free', href: DOWNLOAD_PATH }} />
</TemplatesLayout>
