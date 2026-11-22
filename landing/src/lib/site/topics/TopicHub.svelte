<script lang="ts">
  import '$lib/site/landing/landing.css';
  import '$lib/site/alternatives/alternatives.css';
  import './topics.css';
  import CatalogLayout from '../catalog/CatalogLayout.svelte';
  import { AUTHOR } from '$lib/site/alternatives';
  import { lower } from '$lib/site/lower';
  import { HUBS } from '.';
  import { topicPath, type Hub } from './topic';

  let { hub }: { hub: Hub } = $props();

  const others = $derived(HUBS.filter((h) => h !== hub));
</script>

<svelte:head>
  <title>{hub.title}</title>
  <meta name="description" content={hub.description} />
  <meta property="og:title" content={hub.title} />
  <meta property="og:description" content={hub.description} />
</svelte:head>

<CatalogLayout path={hub.path}>
<article class="landing compare topic">
  <h1>{lower(hub.heading)}</h1>
  <p class="fine">By {AUTHOR.name}, {AUTHOR.role}</p>
  <p class="intro">{hub.intro}</p>

  <div class="cards">
    {#each Object.entries(hub.topics) as [slug, topic] (slug)}
      <a class="card" href={topicPath(hub, slug)}>
        <img src={topic.cover.src} alt={topic.cover.alt} width={topic.cover.width} height={topic.cover.height} loading="lazy" decoding="async" />
        <strong>{lower(topic.heading)}</strong>
        <span>{topic.hook}</span>
      </a>
    {/each}
  </div>

  {#each others as other (other.path)}
    <p><a href={other.path}>{lower(other.heading)} →</a></p>
  {/each}
</article>
</CatalogLayout>
