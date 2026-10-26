<script lang="ts">
  import { APP_URL, GITHUB_URL } from '../links';
  import { LOCAL_COMMANDS, AGENT_PROMPT } from '../home';

  const COPIED_MS = 1500;

  let copied = $state('');

  async function copy(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    copied = id;
    setTimeout(() => (copied = ''), COPIED_MS);
  }
</script>

<section class="hero" id="hero">
  <h1>The open-source infinite canvas for design, motion and AI generation.</h1>
  <p class="lead">One canvas where you and your AI agents draw, animate and generate. Run it on your machine, or in the cloud.</p>

  <div class="block">
    <p class="label">Tell your AI agent (Claude Code, Codex)</p>
    <pre>{AGENT_PROMPT}</pre>
    <button type="button" onclick={() => copy('prompt', AGENT_PROMPT)}>{copied === 'prompt' ? 'Copied' : 'Copy prompt'}</button>
  </div>

  <div class="block">
    <p class="label">Or run it yourself (Node 22)</p>
    <pre>{LOCAL_COMMANDS}</pre>
    <button type="button" onclick={() => copy('commands', LOCAL_COMMANDS)}>{copied === 'commands' ? 'Copied' : 'Copy commands'}</button>
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

  .lead {
    margin-top: 20px;
    max-width: 560px;
    font-size: 18px;
    line-height: 1.3;
    opacity: 0.75;
  }

  .block {
    position: relative;
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
    padding-right: 110px;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'Fragment Mono', monospace;
    font-size: 13px;
    line-height: 1.5;
  }

  button {
    position: absolute;
    top: 12px;
    right: 12px;
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
      padding: 200px 20px 100px;
    }

    h1 {
      font-size: 96px;
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
