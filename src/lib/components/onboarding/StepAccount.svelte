<script lang="ts" module>
  import { Connection } from '$lib/onboarding/session.svelte';
  import { Provider } from '$lib/components/auth/provider-icon';

  const NOTICE: Readonly<Record<Connection, { key: string; error: boolean } | null>> = {
    [Connection.Idle]: null,
    [Connection.Checking]: null,
    [Connection.Browser]: { key: 'onboarding.signin.browser', error: false },
    [Connection.Refused]: { key: 'onboarding.signin.refused', error: true },
    [Connection.Failed]: { key: 'onboarding.signin.failed', error: true }
  };

  const PROVIDERS = [
    { provider: Provider.Google, label: 'login.form.google' },
    { provider: Provider.GitHub, label: 'login.form.github' }
  ] as const;
</script>

<script lang="ts">
  import { _ } from 'svelte-i18n';
  import FeegaMark from '$lib/components/FeegaMark.svelte';
  import Wordmark from '$lib/components/app/Wordmark.svelte';
  import ProviderIcon from '$lib/components/auth/ProviderIcon.svelte';

  type Props = { connection: Connection; onconnect: () => void; onsignin: (email: string, password: string) => void; onskip: () => void };

  let { connection, onconnect, onsignin, onskip }: Props = $props();

  let email = $state('');
  let password = $state('');
  let showPassword = $state(false);

  const busy = $derived(connection === Connection.Browser || connection === Connection.Checking);
  const notice = $derived(NOTICE[connection]);

  function submit(event: SubmitEvent) {
    event.preventDefault();
    onsignin(email.trim(), password);
  }
</script>

<div class="login">
  <span class="lockup"><FeegaMark size={24} /><Wordmark /></span>

  <div class="card">
    <h1 id="ob-title" class="title">{$_('onboarding.signin.title')}</h1>
    <p class="sub">{$_('onboarding.signin.sub')}</p>

    {#if notice}
      <p class="note" class:err={notice.error} role="status" data-testid="onboarding-signin-notice">{$_(notice.key)}</p>
    {/if}

    <div class="providers">
      {#each PROVIDERS as row (row.provider)}
        <button type="button" class="oauth" disabled={busy} onclick={onconnect} data-testid="onboarding-connect-{row.provider}">
          <ProviderIcon provider={row.provider} />
          {$_(row.label)}
        </button>
      {/each}
    </div>

    <div class="divider"><span>{$_('login.form.or')}</span></div>

    <form class="form" onsubmit={submit}>
      <input type="email" name="email" bind:value={email} placeholder={$_('login.form.emailPlaceholder')} autocomplete="email" disabled={busy} required data-testid="onboarding-email" />
      <div class="pwfield">
        <input type={showPassword ? 'text' : 'password'} name="password" bind:value={password} placeholder={$_('login.form.passwordPlaceholder')} autocomplete="current-password" disabled={busy} required data-testid="onboarding-password" />
        <button type="button" class="reveal" onclick={() => (showPassword = !showPassword)} tabindex="-1">
          {showPassword ? $_('login.form.hide') : $_('login.form.show')}
        </button>
      </div>
      <button type="submit" class="cta" disabled={busy} data-testid="onboarding-signin-submit">{connection === Connection.Checking ? $_('login.form.sending') : $_('login.form.signin')}</button>
    </form>

    <p class="toggle">
      {$_('login.signin.noAccount')}
      <button type="button" class="textlink" disabled={busy} onclick={onconnect}>{$_('login.signin.createLink')}</button>
    </p>
  </div>

  <button type="button" class="skip" onclick={onskip} data-testid="onboarding-skip-signin">{$_('onboarding.signin.skip')}</button>
</div>

<style>
  .login {
    width: 100%;
    max-width: 400px;
    margin: 0 auto;
    text-align: center;
  }

  .lockup {
    display: flex;
    line-height: 1;
    width: fit-content;
    align-items: center;
    gap: var(--ui-space-2);
    margin: 0 auto var(--ui-space-6);
    --wordmark-size: 22px;
  }

  .card {
    --field: var(--ui-wash);
    --field-hover: var(--ui-divider);
    padding: var(--ui-space-8);
    background: var(--ui-panel);
    border-radius: var(--ui-radius-lg);
    box-shadow: var(--ui-shadow-raised);
  }

  .title {
    margin: 0;
    font-size: var(--ui-text-xl, 20px);
    font-weight: var(--ui-weight-semibold);
    letter-spacing: -0.02em;
  }

  .sub {
    color: var(--ui-text-secondary);
    margin: var(--ui-space-2) auto var(--ui-space-6);
    max-width: 40ch;
    line-height: 1.5;
  }

  .providers,
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
  }

  input {
    width: 100%;
    box-sizing: border-box;
    font-size: 16px;
    height: 40px;
    padding: 0 12px;
    border: 0;
    outline: none;
    background: var(--field);
    color: var(--ui-text);
    border-radius: var(--ui-radius-md);
    transition: background var(--ui-dur-fast) var(--ui-ease), box-shadow var(--ui-dur-fast) var(--ui-ease);
  }

  input:hover:not(:disabled) {
    background: var(--field-hover);
  }

  input:focus {
    box-shadow: var(--ui-ring);
  }

  input:disabled {
    opacity: 0.6;
  }

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: none;
    height: 40px;
    padding: 0 22px;
    border-radius: var(--ui-radius-md);
    font: inherit;
    font-size: var(--ui-text-lg);
    font-weight: var(--ui-weight-medium);
    cursor: pointer;
    white-space: nowrap;
    transition: background var(--ui-dur-fast) var(--ui-ease), filter var(--ui-dur-fast) var(--ui-ease);
  }

  button:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  button:disabled {
    cursor: default;
    opacity: 0.7;
  }

  .oauth {
    background: var(--field);
    color: var(--ui-text);
  }

  .oauth:hover:not(:disabled) {
    background: var(--field-hover);
  }

  .cta {
    background: var(--ui-accent-solid);
    color: var(--ui-on-accent);
  }

  .cta:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: var(--ui-space-4) 0;
    color: var(--ui-text-tertiary);
    font-size: 13px;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--ui-divider);
  }

  .pwfield {
    position: relative;
  }

  .reveal {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    height: auto;
    background: transparent;
    color: var(--ui-text-secondary);
    font-size: 13px;
    font-weight: 600;
    padding: 6px 8px;
  }

  .note {
    margin: 0 0 var(--ui-space-4);
    padding: var(--ui-space-2) var(--ui-space-3);
    border-radius: var(--ui-radius-md);
    background: var(--ui-wash);
    font-size: 14px;
    line-height: 1.4;
  }

  .note.err {
    color: var(--ui-danger);
    background: color-mix(in srgb, var(--ui-danger) 10%, transparent);
  }

  .toggle {
    margin: var(--ui-space-4) 0 0;
    font-size: 14px;
    color: var(--ui-text-secondary);
  }

  .textlink {
    height: auto;
    padding: 0;
    background: transparent;
    color: var(--ui-accent-text);
    font-size: 14px;
    font-weight: 600;
  }

  .textlink:hover:not(:disabled) {
    text-decoration: underline;
  }

  .skip {
    margin: var(--ui-space-4) auto 0;
    height: 32px;
    padding: 0 12px;
    background: transparent;
    color: var(--ui-text-secondary);
    font-size: 14px;
  }

  .skip:hover {
    color: var(--ui-text);
  }

  @media (max-width: 480px) {
    .card {
      padding: var(--ui-space-6) var(--ui-space-4);
    }
  }
</style>
