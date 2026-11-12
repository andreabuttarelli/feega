<script lang="ts">
  import { CODEBASE } from '$lib/site/codebase';
  import CodebaseStory from '$lib/site/codebase/CodebaseStory.svelte';
</script>

<svelte:head>
  <title>{CODEBASE.title}</title>
  <meta name="description" content={CODEBASE.description} />
  <meta property="og:title" content={CODEBASE.title} />
  <meta property="og:description" content={CODEBASE.description} />
  <meta name="twitter:title" content={CODEBASE.title} />
  <meta name="twitter:description" content={CODEBASE.description} />
</svelte:head>

<article class="codebase site-wide">
  <CodebaseStory level="h1" />

  <section class="close">
    <h2>Bring your codebase.</h2>
    <a class="site-pill" href={CODEBASE.start.href}>{CODEBASE.start.label}</a>
  </section>
</article>

<style>
  .codebase {
    padding: 140px 20px 120px;
  }

  .close {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    margin-top: 140px;
    text-align: center;
  }

  h2 {
    margin: 0;
    font-size: 34px;
    line-height: 36px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .close a {
    width: auto;
    padding: 0 28px;
  }

  @media (min-width: 810px) {
    .codebase {
      padding: 170px 0 160px;
    }

    h2 {
      font-size: 46px;
      line-height: 46px;
    }
  }
</style>
