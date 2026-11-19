<script lang="ts" module>
  const ACCOUNT_ADDS = ['your name and memory, kept on your account', 'Feega Cloud: work on feega.app too, live with other people, share links, comments', 'feega.app’s built-in AI, on your plan’s credits'] as const;
</script>

<script lang="ts">
  import { Connection } from '$lib/onboarding/session.svelte';

  type Props = { email: string | null; connection: Connection; onconnect: () => void; oncontinue: () => void };

  let { email, connection, onconnect, oncontinue }: Props = $props();

  const CONNECT_LABEL: Readonly<Record<Connection, string>> = {
    [Connection.Idle]: 'sign in',
    [Connection.Waiting]: 'finish in your browser…',
    [Connection.Failed]: 'try signing in again'
  };
</script>

<h1 id="ob-title" class="ob-title">sign in to feega?</h1>
<p class="ob-sub">optional. feega is a canvas where you design screens and turn them into animated videos, and it runs on this computer without an account.</p>

<div class="cards">
  <div class="card" data-testid="onboarding-home-computer">
    <div class="head">
      <strong>this computer</strong>
      <span class="tag">free · no account</span>
    </div>
    <p>your work is one file on your disk and works offline. the AI chat is the assistant you already have, like Claude Code or Codex: it runs on your plan with it, no feega credits.</p>
  </div>

  <div class="card" data-testid="onboarding-account">
    <div class="head">
      <strong>a feega account</strong>
      <span class="tag">optional</span>
    </div>
    <ul>
      {#each ACCOUNT_ADDS as line (line)}
        <li>{line}</li>
      {/each}
    </ul>
    {#if email}
      <p class="linked" data-testid="onboarding-connected">connected as {email}</p>
    {:else}
      <button type="button" class="ob-secondary" disabled={connection === Connection.Waiting} onclick={onconnect} data-testid="onboarding-connect">{CONNECT_LABEL[connection]}</button>
    {/if}
  </div>
</div>

<button type="button" class="ob-primary" onclick={oncontinue} data-testid="onboarding-continue">{email ? 'continue' : 'skip'}</button>
<p class="ob-foot">signing in opens feega.app in your browser to sign in. your canvas stays on this computer.</p>

<style>
  .cards {
    display: grid;
    gap: 8px;
    margin: 0 0 16px;
  }

  .card {
    padding: 16px;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-input);
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  strong {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .tag {
    font-family: var(--ui-mono);
    font-size: 11px;
    color: var(--ui-text-secondary);
  }

  p,
  ul {
    margin: 6px 0 0;
    padding: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--ui-text-secondary);
    list-style: none;
  }

  li {
    position: relative;
    padding-left: 18px;
  }

  li::before {
    content: '+';
    position: absolute;
    left: 2px;
    color: var(--ui-text);
  }

  .card :global(.ob-secondary) {
    margin-top: 12px;
  }

  .linked {
    margin-top: 12px;
    color: var(--ui-text);
    font-weight: 500;
  }
</style>
