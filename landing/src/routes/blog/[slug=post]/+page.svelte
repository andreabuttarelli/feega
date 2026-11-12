<script lang="ts">
  import '$lib/site/landing/landing.css';
  import '$lib/site/compare/compare.css';
  import { APP_URL } from '$lib/site/links';
  import { BLOG_PATH } from '$lib/site/compare';
  import { postPath } from '$lib/site/posts';
  import { articleJsonLd } from '$lib/site/structured-data';

  let { data } = $props();

  const post = $derived(data.post);
</script>

<svelte:head>
  <title>{post.title}</title>
  <meta name="description" content={post.description} />
  <meta property="og:title" content={post.title} />
  <meta property="og:description" content={post.description} />
  <meta name="twitter:title" content={post.title} />
  <meta name="twitter:description" content={post.description} />
  {@html articleJsonLd({ title: post.title, description: post.description, path: postPath(data.slug), checked: post.published })}
</svelte:head>

<article class="landing compare">
  <a class="back" href={BLOG_PATH}>← Blog</a>
  <h1>{post.heading}</h1>
  <p class="fine">{post.published}</p>
  <p class="intro">{post.lede}</p>

  {#each post.sections as section (section.heading)}
    <section>
      <h2>{section.heading}</h2>
      <div class="body">{@html section.html}</div>
    </section>
  {/each}

  <a class="landing-cta" href={APP_URL}>Try Feega →</a>
</article>
