<script lang="ts">
  import '$lib/site/landing/landing.css';
  import '$lib/site/alternatives/alternatives.css';
  import './topics.css';
  import { AUTHOR } from '$lib/site/alternatives';
  import { primaryCta } from '$lib/site/install';
  import { lower } from '$lib/site/lower';
  import { topicJsonLd } from '$lib/site/structured-data';
  import CatalogLayout from '../catalog/CatalogLayout.svelte';
  import { topicOutline } from '../catalog/outline';
  import { slugify } from '../catalog/slug';
  import { linkLabel } from '.';
  import { spokenDate, type Hub, type Topic } from './topic';
  import EditorPicture from '../EditorPicture.svelte';
  import TopicFigure from './TopicFigure.svelte';

  let { topic, path, hub }: { topic: Topic; path: string; hub: Hub } = $props();

  const cta = primaryCta();
  const outline = $derived(topicOutline(topic));
</script>

<svelte:head>
  <title>{topic.title}</title>
  <meta name="description" content={topic.description} />
  <meta property="og:title" content={topic.title} />
  <meta property="og:description" content={topic.description} />
  {@html topicJsonLd(topic, path)}
</svelte:head>

<CatalogLayout {path} {outline}>
<article class="landing compare topic">
  <a class="back" href={hub.path}>← {lower(hub.heading)}</a>
  <h1>{lower(topic.heading)}</h1>
  <p class="fine">By {AUTHOR.name}, {AUTHOR.role} · checked {spokenDate(topic.checked)} · <a href="#how-we-checked">how we checked</a></p>

  <section class="short">
    <h2 id="the-short-version">the short version</h2>
    <p class="intro"><strong>{topic.short}</strong></p>
    <TopicFigure figure={topic.cover} eager />
  </section>

  {#each topic.sections as section (section.heading)}
    <section>
      <h2 id={slugify(section.heading)}>{lower(section.heading)}</h2>
      <div class="body">{@html section.html}</div>
      {#if section.figure}<TopicFigure figure={section.figure} />{/if}
      {#if section.editor}<figure class="topic-figure"><EditorPicture id={section.editor} /></figure>{/if}
    </section>
  {/each}

  <section>
    <h2 id="how-we-checked">how we checked</h2>
    <div class="body">{@html topic.howChecked}</div>
    <p class="fine">Something wrong or out of date? Write to <a href="mailto:hi@feega.app">hi@feega.app</a>.</p>
  </section>

  <section>
    <h2 id="try-it-in-2-minutes">try it in 2 minutes</h2>
    <ol>
      {#each topic.tryIt as step (step)}<li>{step}</li>{/each}
    </ol>
    <a class="landing-cta" href={cta.href}>{cta.label} →</a>
  </section>

  <section>
    <h2 id="mistakes-people-make">mistakes people make</h2>
    {#each topic.mistakes as m (m.q)}<p><strong>{m.q}</strong> {m.a}</p>{/each}
  </section>

  <section>
    <h2 id="questions">questions</h2>
    {#each topic.questions as item (item.q)}
      <h3>{item.q}</h3>
      <p>{item.a}</p>
    {/each}
  </section>

  <section>
    <h2 id="sources">sources</h2>
    <ol>
      {#each topic.sources as source (source.href)}
        <li><a href={source.href} rel="noopener">{source.label}</a>, checked {spokenDate(topic.checked)}</li>
      {/each}
    </ol>
  </section>

  <section>
    <h2 id="read-next">read next</h2>
    <ul>
      {#each topic.readNext as next (next)}<li><a href={next}>{linkLabel(next)}</a></li>{/each}
    </ul>
  </section>
</article>
</CatalogLayout>
