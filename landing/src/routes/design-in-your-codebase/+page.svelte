<script lang="ts">
  import '$lib/site/landing/landing.css';
  import { CARRIED, CODEBASE, COMPONENTS_NOTE, NOT_YET, RETURNS, SOURCES, type Fact } from '$lib/site/codebase';
  import Steps from '$lib/site/codebase/Steps.svelte';
  import Frameworks from '$lib/site/codebase/Frameworks.svelte';
</script>

<svelte:head>
  <title>{CODEBASE.title}</title>
  <meta name="description" content={CODEBASE.description} />
  <meta property="og:title" content={CODEBASE.title} />
  <meta property="og:description" content={CODEBASE.description} />
  <meta name="twitter:title" content={CODEBASE.title} />
  <meta name="twitter:description" content={CODEBASE.description} />
</svelte:head>

{#snippet facts(list: readonly Fact[])}
  <dl class="facts">
    {#each list as fact (fact.title)}
      <div>
        <dt>{fact.title}</dt>
        <dd>{fact.text}</dd>
      </div>
    {/each}
  </dl>
{/snippet}

<article class="landing codebase">
  <p class="eyebrow">Code → Design → Code</p>
  <h1>Design in your codebase</h1>
  <p class="intro">Feega runs your app and turns its pages into editable boards on one canvas. Change the design, then send it back to the code as a pull request.</p>
  <a class="landing-cta" href={CODEBASE.cta.href} target="_blank" rel="noopener">{CODEBASE.cta.label}</a>

  <section>
    <h2>How it works</h2>
    <Steps />
  </section>

  <section>
    <h2>Frameworks</h2>
    <Frameworks />
    <p class="note">{COMPONENTS_NOTE}</p>
  </section>

  <section>
    <h2>What comes across</h2>
    {@render facts(CARRIED)}
  </section>

  <section>
    <h2>Where it comes from</h2>
    {@render facts(SOURCES)}
  </section>

  <section>
    <h2>Back to code</h2>
    {@render facts(RETURNS)}
    <p class="note">{NOT_YET}</p>
  </section>
</article>

<style>
  .eyebrow {
    margin: 0 0 16px;
    color: #ff5100;
  }

  .codebase h2 + :global(*) {
    margin-top: 32px;
  }

  .facts {
    margin: 0;
  }

  .facts div {
    display: grid;
    gap: 4px;
    padding: 16px 0;
    border-top: 1px solid var(--site-line);
  }

  .facts div:last-child {
    border-bottom: 1px solid var(--site-line);
  }

  dt {
    color: #fff;
  }

  dd {
    margin: 0;
    opacity: 0.7;
  }

  .note {
    margin-top: 24px;
    font-size: 12px;
    line-height: 16px;
    opacity: 0.5;
  }

  @media (min-width: 810px) {
    .facts div {
      grid-template-columns: 200px minmax(0, 1fr);
      gap: 24px;
    }
  }
</style>
