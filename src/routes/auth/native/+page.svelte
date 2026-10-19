<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { _ } from 'svelte-i18n';
  import PageTitle from '$lib/components/PageTitle.svelte';
  import { TitleSize } from '$lib/components/page-title';
  import { AuthMode as Mode, NEXT_PARAM, nextAfterSignIn } from '$lib/auth/bundle-auth';
  import { OAuthProvider, signInWithPassword, signUpWithPassword, startOAuth, type AuthOutcome } from '$lib/auth/bundle-session';

  let mode = $state(Mode.SignIn);
  let email = $state('');
  let password = $state('');
  let busy = $state(false);
  let error = $state('');
  let confirmSent = $state(false);

  const next = $derived(nextAfterSignIn(page.url.searchParams.get(NEXT_PARAM)));

  function settle(outcome: AuthOutcome): boolean {
    busy = false;
    if (!outcome.ok) {
      error = outcome.error;
    }
    return outcome.ok;
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = '';
    if (mode === Mode.SignUp) {
      confirmSent = settle(await signUpWithPassword(email, password));
      return;
    }
    if (settle(await signInWithPassword(email, password))) {
      await invalidateAll();
      await goto(next);
    }
  }

  async function oauth(provider: OAuthProvider) {
    busy = true;
    error = '';
    settle(await startOAuth(provider, next));
  }
</script>

<div class="native-login">
  <a class="brand" href="/app">feega</a>

  {#if confirmSent}
    <PageTitle size={TitleSize.Small} text={$_('login.signup.title')} />
    <p class="sub" data-testid="native-confirm-sent">Check {email} to confirm the account, then sign in.</p>
    <button type="button" class="textlink" onclick={() => ((confirmSent = false), (mode = Mode.SignIn))}>{$_('login.forgot.back')}</button>
  {:else}
    <PageTitle size={TitleSize.Small} text={mode === Mode.SignUp ? $_('login.signup.title') : $_('login.signin.title')} />

    <div class="oauth-row">
      <button type="button" class="oauth" disabled={busy} onclick={() => oauth(OAuthProvider.Google)}>{$_('login.form.google')}</button>
      <button type="button" class="oauth" disabled={busy} onclick={() => oauth(OAuthProvider.GitHub)}>{$_('login.form.github')}</button>
    </div>

    <form class="form" onsubmit={submit} data-testid="native-login-form">
      <input name="email" type="email" autocomplete="email" required placeholder="Email" bind:value={email} />
      <input name="password" type="password" autocomplete={mode === Mode.SignUp ? 'new-password' : 'current-password'} required placeholder="Password" bind:value={password} />
      {#if error}<p class="err" role="alert">{error}</p>{/if}
      <button type="submit" class="primary" disabled={busy}>{mode === Mode.SignUp ? $_('login.signup.title') : $_('login.signin.title')}</button>
    </form>

    <button type="button" class="textlink" onclick={() => (mode = mode === Mode.SignIn ? Mode.SignUp : Mode.SignIn)}>
      {mode === Mode.SignIn ? $_('login.signup.title') : $_('login.signin.title')}
    </button>
  {/if}
</div>

<style>
  .native-login {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 360px;
    margin: 0 auto;
    padding: 64px 16px;
  }
  .brand {
    font-weight: 600;
    color: inherit;
    text-decoration: none;
  }
  .oauth-row,
  .form {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  input,
  button.oauth,
  button.primary {
    height: 40px;
    padding: 0 12px;
    border-radius: var(--ui-radius-sm);
    border: 1px solid var(--border, #ddd);
    font: inherit;
  }
  button.primary {
    background: var(--foreground, #111);
    color: var(--background, #fff);
  }
  .textlink {
    background: none;
    border: 0;
    padding: 0;
    text-align: left;
    text-decoration: underline;
    cursor: pointer;
    font: inherit;
  }
  .err {
    color: var(--destructive, #c00);
    margin: 0;
  }
  .sub {
    margin: 0;
  }
</style>
