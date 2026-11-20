<script lang="ts">
  import { CLIENT_COPY, CliClient, clientOf } from '$lib/cli-client';
  import { PostOutcome, editorLinks, postSession } from '$lib/cli-session-post';
  import { HOME_PATH } from '$lib/home-path';
  let { data } = $props();
  const { accessToken, refreshToken, expiresAt, cliPort, cliState, userEmail } = data;
  const copy = CLIENT_COPY[clientOf(cliState)];

  type Status = 'idle' | 'sending' | 'done' | 'error';
  let status = $state<Status>('idle');
  let errorMsg = $state('');

  const session = { access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt, state: cliState };
  const links = clientOf(cliState) === CliClient.App ? editorLinks(session) : [];

  async function authorize() {
    status = 'sending';
    const outcome = await postSession(cliPort, session);
    if (outcome === PostOutcome.Sent) {
      status = 'done';
      setTimeout(() => { window.location.href = HOME_PATH; }, 2500);
      return;
    }
    status = 'error';
    errorMsg = copy.unreachable;
  }
</script>

<svelte:head><title>{copy.title}</title></svelte:head>

<div class="wrap">
  <div class="card">
    <div class="logo">feega</div>

    {#if status === 'done'}
      <div class="done">
        <span class="check" aria-hidden="true">✓</span>
        <h2>Signed in</h2>
        <p>{copy.done}</p>
      </div>
    {:else}
      <h2>{copy.heading}</h2>
      <p class="desc">
        {copy.description(userEmail)}
      </p>

      {#if status === 'error'}
        <p class="err">{errorMsg}</p>
        {#each links as link}
          <a class="btn-editor" href={link.href}>Open in {link.label}</a>
        {/each}
      {/if}

      <button class="btn-primary" onclick={authorize} disabled={status === 'sending'}>
        {status === 'sending' ? 'Authorizing…' : 'Authorize'}
      </button>
      <a class="btn-cancel" href={HOME_PATH}>Cancel</a>
    {/if}
  </div>
</div>

<style>
  .wrap {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0a0a;
    padding: 24px;
  }
  .card {
    background: #141414;
    border: 1px solid #2a2a2a;
    padding: 40px 36px;
    max-width: 420px;
    width: 100%;
    box-shadow: 0 4px 32px rgba(0, 0, 0, 0.4);
    text-align: center;
  }
  .logo {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 24px;
    color: #fff;
  }
  h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 8px;
    color: #fff;
  }
  .desc {
    font-size: 14px;
    color: #a1a1a1;
    line-height: 1.55;
    margin: 0 0 28px;
  }
  .btn-primary {
    display: block;
    width: 100%;
    background: #fff;
    color: #000;
    border: none;
    padding: 14px 22px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    margin-bottom: 10px;
  }
  .btn-primary:disabled {
    opacity: 0.7;
    cursor: default;
  }
  .btn-editor {
    display: block;
    border: 1px solid #2a2a2a;
    color: #fff;
    text-decoration: none;
    padding: 12px 22px;
    font-size: 14px;
    margin-bottom: 8px;
  }
  .btn-editor:hover {
    background: #1f1f1f;
  }
  .btn-cancel {
    display: block;
    font-size: 14px;
    color: #a1a1a1;
    text-decoration: none;
    padding: 8px;
  }
  .btn-cancel:hover {
    text-decoration: underline;
  }
  .err {
    font-size: 14px;
    color: #ff6b6b;
    margin-bottom: 16px;
  }
  .done {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .check {
    font-size: 40px;
    color: #fff;
  }
  .done h2 {
    margin: 0;
  }
  .done p {
    font-size: 14px;
    color: #a1a1a1;
    margin: 0;
  }
</style>
