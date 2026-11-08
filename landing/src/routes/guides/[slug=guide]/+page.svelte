<script lang="ts">
  import '$lib/site/landing/landing.css';
  import '$lib/site/compare/compare.css';
  import { APP_URL } from '$lib/site/links';
  import { GUIDES_PATH, guidePath } from '$lib/site/guides';
  import { articleJsonLd, faqJsonLd, howToJsonLd } from '$lib/site/structured-data';

  let { data } = $props();

  const guide = $derived(data.guide);
</script>

<svelte:head>
  <title>{guide.title}</title>
  <meta name="description" content={guide.description} />
  <meta property="og:title" content={guide.title} />
  <meta property="og:description" content={guide.description} />
  <meta name="twitter:title" content={guide.title} />
  <meta name="twitter:description" content={guide.description} />
  {@html articleJsonLd({ title: guide.title, description: guide.description, path: guidePath(data.slug), checked: guide.checked })}
  {@html faqJsonLd(guide.faq)}
  {#if guide.steps.length}{@html howToJsonLd(guide.heading, guide.steps)}{/if}
</svelte:head>

<article class="landing compare">
  <a class="back" href={GUIDES_PATH}>← All guides</a>
  <h1>{guide.heading}</h1>
  <p class="intro">{guide.answer}</p>
  <a class="landing-cta" href={APP_URL}>Try Feega →</a>

  {#if guide.steps.length}
    <section>
      <h2>Steps</h2>
      <ol>
        {#each guide.steps as step (step.name)}
          <li><strong>{step.name}.</strong> {step.text}</li>
        {/each}
      </ol>
    </section>
  {/if}

  {#each guide.sections as section (section.heading)}
    <section>
      <h2>{section.heading}</h2>
      <div class="body">{@html section.html}</div>
    </section>
  {/each}

  <section>
    <h2>FAQ</h2>
    {#each guide.faq as item (item.q)}
      <h3>{item.q}</h3>
      <p>{item.a}</p>
    {/each}
  </section>

  {#if guide.sources?.length}
    <section>
      <h2>Sources</h2>
      <p class="fine">Checked on {guide.checked}. Something wrong? Write to <a href="mailto:hi@feega.app">hi@feega.app</a>.</p>
      <ul>
        {#each guide.sources as source (source.href)}
          <li><a href={source.href} rel="noopener">{source.label}</a></li>
        {/each}
      </ul>
    </section>
  {/if}

  <section>
    <h2>Keep reading</h2>
    <ul>
      {#each guide.links as link (link.href)}
        <li><a href={link.href}>{link.label}</a></li>
      {/each}
    </ul>
    <a class="landing-cta" href={APP_URL}>Try Feega →</a>
  </section>
</article>
