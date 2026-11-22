<script lang="ts">
  import { enhance } from '$app/forms';
  import FeegaMark from '$lib/components/FeegaMark.svelte';
  import Wordmark from '$lib/components/app/Wordmark.svelte';

  let { data, form } = $props();
  let saving = $state(false);

  const MESSAGES: Record<string, string> = {
    name_required: 'enter your first and last name',
    org_required: 'enter an organization name',
    org_name_default: 'pick a name of your own'
  };

  const error = $derived(form?.error ? (MESSAGES[form.error] ?? null) : null);
</script>

<svelte:head>
  <title>welcome to feega</title>
</svelte:head>

<main class="page">
  <div class="inner">
    <a class="lockup" href="/" aria-label="feega"><FeegaMark size={24} /><Wordmark /></a>

    <form
      method="POST"
      action="?/save&next={encodeURIComponent(data.next)}"
      class="card"
      use:enhance={() => {
        saving = true;
        return async ({ update }) => {
          await update({ reset: false });
          saving = false;
        };
      }}
    >
      <h1>welcome to feega</h1>

      {#if data.needsName}
        <section>
          <h2>your name</h2>
          <div class="row">
            <label>
              <span>first name</span>
              <input name="first" autocomplete="given-name" required value={form?.first ?? data.first} />
            </label>
            <label>
              <span>last name</span>
              <input name="last" autocomplete="family-name" required value={form?.last ?? data.last} />
            </label>
          </div>
        </section>
      {/if}

      {#if data.needsOrg}
        <section>
          <h2>your organization</h2>
          <label>
            <span>organization name</span>
            <input name="orgName" autocomplete="organization" required value={form?.orgName ?? data.orgName} />
          </label>
        </section>
      {/if}

      {#if error}<p class="err" role="alert">{error}</p>{/if}

      <button type="submit" class="cta" disabled={saving}>continue</button>
    </form>
  </div>
</main>

<style>
  .page {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--ui-space-8) var(--ui-space-4);
    box-sizing: border-box;
    background: var(--ui-app);
  }
  .inner {
    width: 100%;
    max-width: 400px;
  }
  .lockup {
    display: flex;
    width: fit-content;
    align-items: center;
    gap: var(--ui-space-2);
    margin: 0 auto var(--ui-space-6);
    text-decoration: none;
    line-height: 1;
    --wordmark-size: 22px;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-6);
    padding: var(--ui-space-8);
    background: var(--ui-panel);
    border-radius: var(--ui-radius-lg);
    box-shadow: var(--ui-shadow-raised);
    --field: var(--ui-wash);
    --field-hover: var(--ui-divider);
  }
  h1 {
    margin: 0;
    font-size: var(--ui-text-xl, 20px);
    font-weight: var(--ui-weight-medium);
    color: var(--ui-text);
    text-align: center;
  }
  h2 {
    margin: 0 0 var(--ui-space-2);
    font-size: 13px;
    font-weight: var(--ui-weight-medium);
    color: var(--ui-text-tertiary);
  }
  section {
    display: flex;
    flex-direction: column;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--ui-space-2);
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  label span {
    font-size: 13px;
    color: var(--ui-text-secondary);
  }
  input {
    width: 100%;
    box-sizing: border-box;
    height: 40px;
    padding: 0 12px;
    border: 0;
    outline: none;
    font-size: 16px;
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
  .cta {
    height: 40px;
    border: 0;
    border-radius: 999px;
    font-size: var(--ui-text-lg);
    font-weight: var(--ui-weight-medium);
    cursor: pointer;
    background: var(--ui-accent-solid);
    color: var(--ui-on-accent);
    transition: filter var(--ui-dur-fast) var(--ui-ease);
  }
  .cta:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  .cta:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }
  .cta:disabled {
    cursor: default;
    opacity: 0.7;
  }
  .err {
    margin: 0;
    color: var(--ui-danger, #e5484d);
    font-size: 14px;
    text-align: center;
  }
  @media (max-width: 480px) {
    .row {
      grid-template-columns: 1fr;
    }
  }
</style>
