<script lang="ts">
  import '../../../../packages/site-theme/tokens.css';
  import FeegaMark from '$lib/components/FeegaMark.svelte';
  import { CLIENT_COPY, CliClient, clientOf } from '$lib/cli-client';
  import { PostOutcome, desktopLink, editorLinks, postSession } from '$lib/cli-session-post';
  import { HOME_PATH } from '$lib/home-path';
  import { Status } from './status';

  let { data } = $props();
  const { accessToken, refreshToken, expiresAt, cliPort, cliState, userEmail } = data;
  const client = clientOf(cliState);
  const copy = CLIENT_COPY[client];
  const DONE_REDIRECT_MS = 2500;

  let status = $state(Status.Ready);

  const session = { access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt, state: cliState };
  const LINKS_OF: Record<CliClient, { label: string; href: string }[]> = {
    [CliClient.Terminal]: [],
    [CliClient.App]: editorLinks(session),
    [CliClient.Desktop]: [desktopLink(session)]
  };
  const links = LINKS_OF[client];
  const MESSAGE_OF: Partial<Record<Status, string>> = { [Status.Unreachable]: copy.unreachable, [Status.Rejected]: copy.rejected };
  const OUTCOME_STATUS: Record<PostOutcome, Status> = {
    [PostOutcome.Sent]: Status.Done,
    [PostOutcome.Rejected]: Status.Rejected,
    [PostOutcome.Unreachable]: Status.Unreachable
  };
  const AUTHORIZE_LABEL: Record<Status, string> = {
    [Status.Ready]: 'authorize',
    [Status.Sending]: 'authorizing…',
    [Status.Done]: 'authorize',
    [Status.Rejected]: 'try again',
    [Status.Unreachable]: 'try again'
  };

  async function authorize() {
    status = Status.Sending;
    status = OUTCOME_STATUS[await postSession(cliPort, session)];

    if (status === Status.Done) {
      setTimeout(() => {
        window.location.href = HOME_PATH;
      }, DONE_REDIRECT_MS);
    }
  }
</script>

<svelte:head><title>{copy.title}</title></svelte:head>

<main class="page">
  <a class="brand" href={HOME_PATH}>
    <FeegaMark size={22} />
    <span>feega</span>
  </a>

  <section class="card" aria-live="polite">
    {#if status === Status.Done}
      <span class="check" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </span>
      <h1>signed in</h1>
      <p class="lead">{copy.done}</p>
    {:else}
      <p class="who">{userEmail}</p>
      <h1>{copy.heading}</h1>

      {#if MESSAGE_OF[status]}
        <p class="notice" role="alert">{MESSAGE_OF[status]}</p>
      {:else}
        <p class="lead">{copy.description(userEmail)}</p>
      {/if}

      {#if status === Status.Unreachable}
        <div class="stack">
          {#each links as link (link.href)}
            <a class={links.length > 1 ? 'pill ghost' : 'pill solid'} href={link.href}>open in {link.label.toLowerCase()}</a>
          {/each}
        </div>
      {/if}

      <div class="stack">
        <button class="pill {status === Status.Unreachable && links.length ? 'ghost' : 'solid'}" onclick={authorize} disabled={status === Status.Sending}>
          {AUTHORIZE_LABEL[status]}
        </button>
        <a class="pill ghost" href={HOME_PATH}>cancel</a>
      </div>
    {/if}
  </section>
</main>

<style>
  .page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sx-s6);
    padding: var(--sx-s5) var(--sx-gutter);
    background: var(--sx-bg);
    color: var(--sx-ink);
    font-family: var(--sx-font);
    font-weight: var(--sx-w-body);
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: var(--sx-s2);
    color: #fff;
    font-size: 22px;
    letter-spacing: -0.04em;
    text-decoration: none;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: var(--sx-s3);
    width: 100%;
    max-width: 440px;
    padding: var(--sx-s6);
    border: 1px solid var(--sx-line);
    border-radius: var(--sx-radius-xl);
    background: var(--sx-grey-1);
  }

  .who {
    align-self: flex-start;
    margin: 0;
    padding: 4px 12px;
    border-radius: 999px;
    background: var(--sx-pill);
    color: var(--sx-ink-2);
    font-family: var(--sx-mono);
    font-size: var(--sx-fs-mono);
    overflow-wrap: anywhere;
  }

  h1 {
    margin: var(--sx-s2) 0 0;
    color: #fff;
    font-family: inherit;
    font-size: var(--sx-fs-h2);
    font-weight: var(--sx-w-title);
    line-height: 1.05;
    letter-spacing: var(--sx-track-title);
  }

  .lead,
  .notice {
    margin: 0;
    color: var(--sx-ink-2);
    font-size: var(--sx-fs-small);
    line-height: 1.55;
  }

  .notice {
    padding: var(--sx-s3) var(--sx-s4);
    border-left: 2px solid var(--sx-accent);
    border-radius: var(--sx-radius-md);
    background: var(--sx-tint-accent);
    color: var(--sx-ink);
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--sx-s2);
    margin-top: var(--sx-s2);
  }

  .pill {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    padding: 0 26px;
    border: 1px solid transparent;
    border-radius: 999px;
    font: inherit;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.02em;
    text-decoration: none;
    cursor: pointer;
    transition:
      border-color 0.15s,
      opacity 0.15s;
  }

  .solid {
    background: #fff;
    color: #000;
  }

  .ghost {
    border-color: rgb(255 255 255 / 0.3);
    background: transparent;
    color: #fff;
  }

  .ghost:hover {
    border-color: #fff;
  }

  .pill:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .pill:focus-visible {
    outline: 2px solid var(--sx-accent);
    outline-offset: 2px;
  }

  .check {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    background: var(--sx-tint-accent);
    color: var(--sx-accent);
  }
</style>
