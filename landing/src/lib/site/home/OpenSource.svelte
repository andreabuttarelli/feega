<script lang="ts">
  import { page } from '$app/state';
  import { AGENT_LOGOS } from '../home';
  import { APP_URL } from '../links';

  type Copy = { first: string; second: string; agents: string; before: string; after: string };

  const COPY: Record<string, Copy> = {
    '1': { first: 'Open the Feega VS Code extension in your codebase →', second: 'start designing directly in your real app.', agents: 'Use it with your', before: 'Then move to', after: 'to collaborate in real time.' },
    '2': { first: 'Open the Feega VS Code extension in your codebase.', second: 'Start designing directly in your real app.', agents: 'Use it with your', before: 'Then move to', after: 'to collaborate in real time.' },
    '3': { first: 'Open the Feega VS Code extension in your codebase →', second: 'start designing directly in real app.', agents: 'Use with your', before: 'Move then in', after: 'to collaborate in real-time' }
  };

  const secondary = $derived(page.url.searchParams.get('last') === 'sub');
  const copy = $derived(COPY[page.url.searchParams.get('copy') ?? '1'] ?? COPY['1']);
</script>

<section class="open site-wide">
  <h2 data-agent-id="open-title">
    {copy.first}<br />{copy.second}<br />{copy.agents}
    <span class="tail">agents<span class="logos" data-agent-id="open-logos">{#each AGENT_LOGOS as logo (logo.file)}<img src="/site/home/{logo.file}" alt={logo.name} width={logo.width} height="32" />{/each}</span></span>
    <span class="closing" class:secondary>{copy.before} <a href={APP_URL}>Feega Cloud</a> {copy.after}</span>
  </h2>
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
    text-wrap: balance;
    max-width: 1000px;
    margin-inline: auto;
    overflow-wrap: break-word;
  }

  .closing {
    display: block;
  }

  .closing.secondary {
    margin-top: 0.5em;
    font-size: 0.6em;
    line-height: 1.3;
    opacity: 0.6;
  }

  .closing a {
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }

  .tail {
    white-space: nowrap;
  }

  .logos {
    display: inline-flex;
    gap: 0.25em;
    margin-left: 0.3em;
    vertical-align: baseline;
  }

  .logos img {
    height: 0.72em;
    width: auto;
    align-self: baseline;
  }

  @media (min-width: 810px) {
    .open {
      padding: var(--site-section) 0 0;
    }

    h2 {
      font-size: 30px;
      line-height: 36px;
    }
  }

  @media (min-width: 1200px) {
    h2 {
      font-size: 38px;
      line-height: 45.6px;
    }
  }
</style>
