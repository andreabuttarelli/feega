<script lang="ts">
  import { page } from '$app/state';
  import { AGENT_LOGOS } from '../home';

  const COPY: Record<string, string> = {
    a: 'Edits land the same frame. Your agent draws, animates and generates on the canvas while you watch. Open source.',
    b: 'Import your code. Design on the canvas. Export React, Svelte or HTML back to your repo. Open source, Apache-2.0.',
    c: 'Ask your agent for a motion video. It edits the canvas, generates the images and renders the MP4.',
    d: 'Runs on your machine from one file. No account, no database. Open source, Apache-2.0.'
  };

  const text = $derived(COPY[page.url.searchParams.get('copy') ?? 'a'] ?? COPY.a);
</script>

<section class="open site-wide">
  <h2 data-agent-id="open-title">{text}</h2>

  <ul class="logos" data-agent-id="open-logos">
    {#each AGENT_LOGOS as logo (logo.file)}
      <li><img src="/site/home/{logo.file}" alt={logo.name} width={logo.width} height="32" /></li>
    {/each}
  </ul>
</section>

<style>
  .open {
    padding: var(--site-section) 20px 0;
    color: var(--site-ink);
  }

  h2 {
    font-size: 24px;
    line-height: 28.8px;
    letter-spacing: -0.04em;
    font-weight: 400;
    text-align: center;
    white-space: pre-wrap;
    text-wrap: balance;
    max-width: 1000px;
    margin-inline: auto;
    overflow-wrap: break-word;
  }

  .logos {
    display: flex;
    justify-content: space-between;
    margin: 40px 0 0;
    padding: 0;
    list-style: none;
  }

  @media (min-width: 810px) {
    .open {
      padding: var(--site-section) 0 0;
    }

    h2 {
      font-size: 30px;
      line-height: 36px;
    }

    .logos {
      justify-content: space-around;
      width: 400px;
      margin: 40px auto 0;
    }
  }

  @media (min-width: 1200px) {
    h2 {
      font-size: 38px;
      line-height: 45.6px;
    }
  }
</style>
