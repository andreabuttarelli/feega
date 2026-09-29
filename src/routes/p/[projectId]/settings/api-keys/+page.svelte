<script lang="ts">
  import { enhance } from '$app/forms';
  import { _ } from 'svelte-i18n';
  import { Panel } from '$lib/components/ui/panel';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';

  let { data, form } = $props();

  let apiKeyModalOpen = $state(false);
  let copied = $state(false);
  let confirmingRevoke = $state<string | null>(null);

  function closeApiKeyModal() {
    apiKeyModalOpen = false;
    copied = false;
  }

  function copyKey(raw: string) {
    navigator.clipboard.writeText(raw);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

{#if form?.apiKeyError}<Notice tone="error">{form.apiKeyError}</Notice>{/if}
{#if form?.apiKeyRevoked}<Notice tone="success">{$_('app.settings.apiKeys.keyRevoked')}</Notice>{/if}

<Panel title={$_('app.settings.apiKeys.title')} description={$_('app.settings.apiKeys.subtitle')}>
  {#snippet actions()}
    <Button variant="secondary" size="sm" onclick={() => (apiKeyModalOpen = true)}>{$_('app.settings.apiKeys.createKey')}</Button>
  {/snippet}

  {#if form?.apiKeyCreated && form?.apiKeyRaw}
    <div class="apikey-created">
      <div class="apikey-warning">{$_('app.settings.apiKeys.warning')}</div>
      <div class="apikey-copy-row">
        <code class="apikey-raw">{form.apiKeyRaw}</code>
        <Button size="sm" onclick={() => copyKey(form.apiKeyRaw)}>{copied ? $_('app.settings.apiKeys.copied') : $_('app.settings.apiKeys.copyKey')}</Button>
      </div>
    </div>
  {/if}

  {#if data.apiKeys.length}
    <div class="apikey-list">
      {#each data.apiKeys as k (k.id)}
        <div class="apikey-row">
          <div class="apikey-info">
            <div class="apikey-name">{k.name}</div>
            <div class="apikey-meta">
              <code class="apikey-prefix">{k.key_prefix}…</code>
              <span class="apikey-scope">
                {#if k.scopes?.includes('write')}
                  <span class="scope-badge write">{$_('app.settings.apiKeys.write')}</span>
                {/if}
                <span class="scope-badge read">{$_('app.settings.apiKeys.read')}</span>
              </span>
              <span class="scope-badge all">{$_('app.settings.apiKeys.allBrands')}</span>
            </div>
            <div class="apikey-dates">
              {$_('app.settings.apiKeys.created')}: {new Date(k.created_at).toLocaleDateString()}
              · {$_('app.settings.apiKeys.lastUsed')}: {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : $_('app.settings.apiKeys.never')}
            </div>
          </div>
          {#if confirmingRevoke === k.id}
            <div class="disc-confirm">
              <form method="POST" action="?/revokeApiKey" use:enhance>
                <input type="hidden" name="key_id" value={k.id} />
                <Button variant="danger" size="sm" type="submit">{$_('app.settings.apiKeys.revoke')}</Button>
              </form>
              <Button variant="ghost" size="sm" onclick={() => (confirmingRevoke = null)}>{$_('app.settings.keep')}</Button>
            </div>
          {:else}
            <Button variant="ghost" size="sm" onclick={() => (confirmingRevoke = k.id)}>{$_('app.settings.apiKeys.revoke')}</Button>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <p class="m-0 text-[0.8125rem] text-muted-foreground">{$_('app.settings.apiKeys.noKeys')}</p>
  {/if}
</Panel>

{#if apiKeyModalOpen}
  <div
    class="cx-overlay"
    role="button"
    tabindex="-1"
    aria-label={$_('app.settings.close')}
    onclick={(e) => e.target === e.currentTarget && closeApiKeyModal()}
    onkeydown={(e) => e.key === 'Escape' && closeApiKeyModal()}
  >
    <div class="cx-card" role="dialog" aria-modal="true">
      <h3>{$_('app.settings.apiKeys.createKey')}</h3>
      <form
        method="POST"
        action="?/createApiKey"
        use:enhance={() => {
          return async ({ result, update }) => {
            await update();
            if (result.type === 'success' && result.data?.apiKeyRaw) {
              apiKeyModalOpen = false;
            }
          };
        }}
      >
        <div class="apikey-form-field">
          <label for="key_name">{$_('app.settings.apiKeys.keyName')}</label>
          <input id="key_name" name="key_name" type="text" placeholder={$_('app.settings.apiKeys.keyNamePlaceholder')} />
        </div>
        <div class="apikey-form-field">
          <label>{$_('app.settings.apiKeys.scopes')}</label>
          <div class="apikey-scopes">
            <label class="cx-reason sel"><input type="checkbox" checked disabled /> {$_('app.settings.apiKeys.read')}</label>
            <label class="cx-reason"><input type="checkbox" name="write" value="true" /> {$_('app.settings.apiKeys.write')}</label>
          </div>
        </div>
        <div class="cx-actions">
          <Button variant="secondary" onclick={closeApiKeyModal}>{$_('app.settings.close')}</Button>
          <Button type="submit">{$_('app.settings.apiKeys.createKey')}</Button>
        </div>
      </form>
    </div>
  </div>
{/if}
