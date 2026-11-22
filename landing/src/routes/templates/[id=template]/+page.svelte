<script lang="ts">
  import { lower } from '$lib/site/lower';
  import { AUTHOR } from '$lib/site/alternatives';
  import { CalloutTone } from '$lib/site/alternatives/alternative';
  import Callout from '$lib/site/alternatives/Callout.svelte';
  import CtaBlock from '$lib/site/alternatives/CtaBlock.svelte';
  import Table from '$lib/site/alternatives/Table.svelte';
  import { DOWNLOAD_PATH } from '$lib/site/links';
  import CodeTabs from '$lib/site/templates/CodeTabs.svelte';
  import PreviewFrame from '$lib/site/templates/PreviewFrame.svelte';
  import TemplateCard from '$lib/site/templates/TemplateCard.svelte';
  import TemplatesLayout from '$lib/site/templates/TemplatesLayout.svelte';
  import { CATEGORY_COPY } from '$lib/site/templates/copy';
  import { relatedTo, sizesText } from '$lib/site/templates/guide';
  import { templateJsonLd } from '$lib/site/templates/jsonld';
  import { templateMeta } from '$lib/site/templates/meta';
  import { TEMPLATES_HEADING } from '$lib/site/templates';
  import { CATEGORY_SLUGS, TEMPLATES_PATH, TOKENS_PATH, categoryPath, templatePath } from '$lib/site/templates/paths';
  import { fontsLinkTag } from '$lib/site/templates/preview';
  import { Framework, Theme, Tier } from '$lib/site/templates/template';

  let { data } = $props();

  const template = $derived(data.template);
  const meta = $derived(templateMeta(template));
  const related = $derived(relatedTo(template));
  const isPro = $derived(template.tier === Tier.Pro);
  const fontTag = $derived(fontsLinkTag(template.fonts));
  const tokenTable = $derived({
    heading: 'Tokens this template reads',
    head: ['Token', 'Controls', 'Uses'],
    rows: data.facts.tokens.map((t: { token: string; meaning: string; uses: number }) => [t.token, t.meaning, String(t.uses)])
  });
</script>

<svelte:head>
  <title>{meta.title}</title>
  <meta name="description" content={meta.description} />
  <meta property="og:title" content={meta.title} />
  <meta property="og:description" content={meta.description} />
  {@html templateJsonLd(template, meta.description)}
</svelte:head>

<TemplatesLayout>
  <p class="crumbs">
    <a href={TEMPLATES_PATH}>{lower(TEMPLATES_HEADING)}</a> <span>/</span>
    <a href={categoryPath(template.category)}>{lower(CATEGORY_COPY[template.category].label)}</a>
  </p>
  <h1>{lower(template.name)}</h1>
  <p class="fine">By {AUTHOR.name}, {AUTHOR.role} · {isPro ? 'Included in Feega Cloud' : 'Free'} · Svelte, React, Vue, Astro, HTML</p>
  <p class="intro lede">{template.description}</p>
  <p class="meta-row">
    {#each template.tags as tag (tag)}<span class="tag">{tag}</span>{/each}
  </p>

  <PreviewFrame {template} />

  <section>
    <h2>{lower('Code')}</h2>
    {#if isPro}
      <div class="pro-note">
        <Callout item={{ tone: CalloutTone.Note, title: 'Included in Feega Cloud', text: 'This template is part of the Pro library in Feega Cloud. The preview above is the real thing; the code is available to Cloud teams.' }} />
      </div>
    {:else}
      <CodeTabs code={data.code} initial={Framework.Svelte} />
      <details class="tokens">
        <summary>tokens.css, the shared file every template reads</summary>
        <div class="tpl-code">
          <figure class="file">
            <figcaption><span>tokens.css</span><a href={TOKENS_PATH}>open file</a></figcaption>
            <pre tabindex="0"><code>{data.tokensCss}</code></pre>
          </figure>
        </div>
      </details>
    {/if}
  </section>

  <section>
    <h2>{lower('What it is')}</h2>
    <div class="body">
      <p>{data.facts.intro}</p>
      <p>{data.facts.behaviour}</p>
      <p>{sizesText(data.facts.sizes)}</p>
    </div>
  </section>

  {#if data.facts.tokens.length}
    <Table block={tokenTable} />
    <div class="body">
      <p>
        To restyle it, set any of these custom properties on <code>:root</code>, or on an ancestor of the template to change it in one place only. For example, <code>--feega-accent</code> changes the brand colour in light and dark alike. Add the shared <a href={TOKENS_PATH}>tokens.css</a> once per project.
      </p>
    </div>
  {/if}

  <section>
    <h2>{lower('Fonts')}</h2>
    <div class="body"><p>{data.facts.fonts}</p></div>
    {#if fontTag}
      <figure class="file">
        <figcaption><span>head</span></figcaption>
        <pre tabindex="0"><code>{fontTag}</code></pre>
      </figure>
    {/if}
  </section>

  <section>
    <h2>{lower('Insert with Feega')}</h2>
    <div class="body">
      <p>
        Open Add, then Library, and click Insert or drag it into your running app. Feega writes the component, tokens and fonts for your framework. One undo. <a href="https://docs.feega.app/getting-started/library/">how it works</a>
      </p>
    </div>
    <CtaBlock item={{ text: 'Free VS Code extension. No account, no AI.', label: 'get feega', href: DOWNLOAD_PATH }} />
  </section>

  <section>
    <h2>{lower('Related templates')}</h2>
    <ul class="related">
      {#each related as other (other.id)}
        <li><TemplateCard template={other} theme={Theme.Dark} /></li>
      {/each}
    </ul>
    <p class="fine"><a href={templatePath(template.id)} hidden>{template.name}</a></p>
  </section>
</TemplatesLayout>
