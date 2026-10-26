<script lang="ts">
  import '$lib/site/landing/landing.css';
  import { srcset, type Cta } from '$lib/site/landing';

  const SIZES = '(min-width: 1200px) 1160px, 100vw';

  let { data } = $props();
</script>

<svelte:head>
  <title>{data.title}</title>
  <meta name="description" content={data.description} />
  <meta property="og:title" content={data.title} />
  <meta property="og:description" content={data.description} />
  <meta name="twitter:title" content={data.title} />
  <meta name="twitter:description" content={data.description} />
  <link rel="preload" as="image" href={data.hero.src} imagesrcset={srcset(data.hero.src)} imagesizes={SIZES} fetchpriority="high" />
</svelte:head>

{#snippet button(cta: Cta)}
  <a class="landing-cta" href={cta.href} target="_blank" rel="noopener">{cta.label}</a>
{/snippet}

<article class="landing" style:--hero="{data.heroHeight}px" style:--example="{data.exampleHeight}px">
  <h1>{data.heading}</h1>
  <p class="intro">{@html data.intro}</p>
  {@render button(data.cta)}

  <img class="hero-image" src={data.hero.src} srcset={srcset(data.hero.src)} sizes={SIZES} alt={data.hero.alt} width="1600" height="900" fetchpriority="high" />

  {#each data.sections as section (section.heading)}
    <section>
      <h2>{section.heading}</h2>

      {#if section.examples.length}
        <div class="examples">
          {#each section.examples as figure (figure.src)}
            <figure>
              <img src={figure.src} srcset={srcset(figure.src)} sizes={SIZES} alt={figure.alt} width="1600" height="900" loading="lazy" />
              <figcaption>{figure.alt}</figcaption>
            </figure>
          {/each}
        </div>
      {:else}
        <div class="body">{@html section.html}</div>
      {/if}

      {#if section.cta}
        {@render button(section.cta)}
      {/if}
    </section>
  {/each}
</article>

