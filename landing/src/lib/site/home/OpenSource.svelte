<script lang="ts">
  import { page } from '$app/state';
  import { AGENT_LOGOS } from '../home';
  import { APP_URL } from '../links';

  type Copy = { before: string };

  const COPY: Record<string, Copy> = {
    '1': { before: 'Open the Feega VS Code extension in your codebase, design directly in your real app with your' },
    '2': { before: 'Open the Feega VS Code extension in your codebase to design directly in your real app with your' },
    '3': { before: 'Design directly in your real app from the Feega VS Code extension, with your' }
  };

  const copy = $derived(COPY[page.url.searchParams.get('copy') ?? '1'] ?? COPY['1']);
</script>

<section class="open site-wide">
  <h2 data-agent-id="open-title">
    {copy.before}
    <span class="tail">agents<span class="logos" data-agent-id="open-logos">{#each AGENT_LOGOS as logo (logo.file)}<img src="/site/home/{logo.file}" alt={logo.name} width={logo.width} height="32" />{/each}</span>,</span>
    then move to <a href={APP_URL}>Feega Cloud</a> to collaborate in real time.
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

  h2 a {
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
