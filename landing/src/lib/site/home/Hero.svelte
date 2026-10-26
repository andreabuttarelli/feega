<script lang="ts">
  import { APP_URL, GITHUB_URL } from '../links';
  import { LOCAL_COMMANDS, AGENT_PROMPT } from '../home';

  const POSTER = '/site/home/hero-poster.webp';
  const COPIED_MS = 1500;

  let copied = $state('');

  async function copy(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    copied = id;
    setTimeout(() => (copied = ''), COPIED_MS);
  }
</script>

<svelte:head>
  <link rel="preload" as="image" href={POSTER} type="image/webp" fetchpriority="high" />
</svelte:head>

<section class="hero" id="hero">
  <h1>The smart canvas for smarter ideas</h1>

  <video autoplay muted loop playsinline preload="metadata" poster={POSTER} width="1920" height="1080" aria-label="feega canvas overview">
    <source src="/site/home/hero-720.mp4" type="video/mp4" media="(max-width: 800px)" />
    <source src="/site/home/hero-1080.mp4" type="video/mp4" />
  </video>

  <p class="lead">One canvas where you and your AI agents draw, animate and generate. Run it on your machine, or in the cloud.</p>

  <div class="block">
    <div class="head">
      <p class="label">Tell your AI agent (Claude Code, Codex)</p>
      <button type="button" onclick={() => copy('prompt', AGENT_PROMPT)}>{copied === 'prompt' ? 'Copied' : 'Copy prompt'}</button>
    </div>
    <pre>{AGENT_PROMPT}</pre>
  </div>

  <div class="block">
    <div class="head">
      <p class="label">Or run it yourself (Node 22)</p>
      <button type="button" onclick={() => copy('commands', LOCAL_COMMANDS)}>{copied === 'commands' ? 'Copied' : 'Copy commands'}</button>
    </div>
    <pre>{LOCAL_COMMANDS}</pre>
  </div>

  <p class="cloud">
    Prefer the cloud?
    <a class="primary" href="{APP_URL}/login">Sign up</a>
    <a href="{APP_URL}/login">Log in</a>
    <a href={GITHUB_URL}>Star on GitHub</a>
  </p>
</section>

<style>
  .hero {
    max-width: 1160px;
    margin: 0 auto;
    padding: 120px 20px 60px;
  }

  h1 {
    font-size: 44px;
    line-height: 0.95;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  video {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
    margin-top: 24px;
    background: #000;
    border-radius: 10px;
  }

  .lead {
    margin-top: 20px;
    max-width: 560px;
    font-size: 18px;
    line-height: 1.3;
    opacity: 0.75;
  }

  .block {
    margin-top: 24px;
    max-width: 760px;
    padding: 16px;
    background: #141414;
    border: 1px solid var(--site-line);
    border-radius: 10px;
  }

  .label {
    opacity: 0.6;
  }

  pre {
    margin: 10px 0 0;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'Fragment Mono', monospace;
    font-size: 13px;
    line-height: 1.5;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  button {
    flex: none;
    padding: 6px 10px;
    font: inherit;
    color: var(--site-ink);
    background: #262626;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
  }

  .cloud {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 20px;
    margin-top: 32px;
  }

  .cloud a {
    border-bottom: 1px solid var(--site-ink);
  }

  .cloud .primary {
    padding: 12px 24px;
    background: #0043fc;
    border: 0;
    border-radius: 6px;
  }

  @media (min-width: 1200px) {
    .hero {
      padding: 120px 20px 80px;
    }

    h1 {
      font-size: 64px;
      max-width: 1100px;
    }

    .lead {
      font-size: 24px;
      max-width: 720px;
    }

    pre {
      font-size: 14px;
    }
  }
</style>
