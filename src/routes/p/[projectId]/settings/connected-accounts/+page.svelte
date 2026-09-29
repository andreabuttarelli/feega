<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';
  import { billingPath } from '$lib/billing-path';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { Panel } from '$lib/components/ui/panel';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { PLATFORMS, ICONS } from '$lib/components/settings/platforms';

  let { data, form } = $props();
  const base = $derived(`/p/${data.project.id}`);
  const atLimit = $derived(data.used >= data.limit);
  const q = (key: string) => $page.url.searchParams.get(key);
  const limitError = $derived(q('error') === 'limit');
  const connected = $derived(data.accounts.filter((a) => a.status === 'active'));

  let syncForm = $state<HTMLFormElement | null>(null);
  let pendingConnect = $state(false);
  let confirmingDisconnect = $state<string | null>(null);
  let disconnecting = $state<string | null>(null);
  let syncing = $state(false);

  // Coming back from the OAuth tab, the sync runs for a few seconds — say so instead of showing
  // the stale "no accounts" state as if nothing happened.
  const withSpinner = () => {
    syncing = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      await update();
      syncing = false;
    };
  };

  const withDisconnectSpinner = (id: string) => () => {
    disconnecting = id;
    return async ({ update }: { update: () => Promise<void> }) => {
      try {
        await update();
      } finally {
        disconnecting = null;
      }
    };
  };

  onMount(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && pendingConnect) {
        pendingConnect = false;
        syncForm?.requestSubmit();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    if (q('connected')) {
      syncForm?.requestSubmit();
      history.replaceState(history.state, '', $page.url.pathname);
    }
    return () => document.removeEventListener('visibilitychange', onVisible);
  });
</script>

{#if form?.error}<Notice tone="error">{form.error}</Notice>{/if}
{#if form?.synced}<Notice tone="success">{$_('app.settings.syncedToast')}</Notice>{/if}
{#if form?.disconnected}<Notice tone="success">{$_('app.settings.disconnectedToast')}</Notice>{/if}

<Panel title={$_('app.settings.connectedAccounts')}>
  {#snippet actions()}
    <form method="POST" action="?/sync" use:enhance={withSpinner} bind:this={syncForm}>
      <Button variant="secondary" size="sm" type="submit" disabled={syncing}>
        {syncing ? $_('app.ads.syncing') : $_('app.settings.syncFromZernio')}
      </Button>
    </form>
  {/snippet}

  {#if syncing}
    <div class="acct">
      <Skeleton class="size-[34px]" />
      <div class="nm"><Skeleton class="mb-1.5 h-3.5 w-40" /><Skeleton class="h-3 w-24" /></div>
    </div>
  {:else if connected.length}
    {#each connected as a (a.id)}
      {@const pk = (a.platform ?? '').toLowerCase()}
      {@const pm = PLATFORMS.find((p) => p.key === pk)}
      <div class="acct">
        <div class="glyph" style={`background:${pm?.bg ?? '#7c5cff'}`}>
          {#if ICONS[pk]}<svg viewBox="0 0 24 24" fill="#fff"><path d={ICONS[pk].path} /></svg>{:else}{pm?.glyph ?? (a.platform ?? '?').slice(0, 2).toUpperCase()}{/if}
        </div>
        <div class="nm"><div class="h">{a.display_name ?? a.handle ?? a.platform}</div><div class="s">{a.platform}{a.handle ? ` · @${a.handle}` : ''}</div></div>
        {#if confirmingDisconnect === a.id}
          <form method="POST" action="?/disconnect" use:enhance={withDisconnectSpinner(a.id)} class="disc-confirm" aria-busy={disconnecting === a.id}>
            <input type="hidden" name="id" value={a.id} />
            <Button variant="danger" size="sm" type="submit" disabled={disconnecting === a.id}>
              {disconnecting === a.id ? $_('app.settings.del.deleting') : $_('app.settings.remove')}
            </Button>
            <Button variant="ghost" size="sm" disabled={disconnecting === a.id} onclick={() => (confirmingDisconnect = null)}>{$_('app.settings.keep')}</Button>
          </form>
        {:else}
          <span class="status"><span class="d"></span>{$_('app.settings.active')}</span>
          <Button variant="ghost" size="sm" onclick={() => (confirmingDisconnect = a.id)}>{$_('app.settings.disconnect')}</Button>
        {/if}
      </div>
    {/each}
  {:else}
    <div>
      <p class="m-0 text-sm font-semibold">{$_('app.settings.noAccountsTitle')}</p>
      <p class="m-0 text-[0.8125rem] text-muted-foreground">{$_('app.settings.noAccountsBody')}</p>
    </div>
  {/if}
</Panel>

<Panel
  title={$_('app.settings.connectPlatform')}
  description={`${$_('app.settings.accountsUsed', { values: { used: data.used, limit: data.limit } })} · ${$_('app.settings.seatCostMsg', { values: { cost: data.seatCostUsd } })}`}
>
  {#if limitError}
    <div><Notice tone="error" class="mb-0">{$_('app.settings.limitReachedMsg', { values: { limit: data.limit } })}</Notice></div>
  {/if}
  {#each PLATFORMS as p (p.key)}
    {@const count = connected.filter((a) => (a.platform ?? '').toLowerCase() === p.key).length}
    <div class="acct">
      <div class="glyph" style={`background:${p.bg}`}>
        {#if ICONS[p.key]}<svg viewBox="0 0 24 24" fill="#fff"><path d={ICONS[p.key].path} /></svg>{:else}{p.glyph}{/if}
      </div>
      <div class="nm"><div class="h">{p.label}</div><div class="s">{count ? $_('app.settings.connectedAddAnother', { values: { count } }) : $_('app.settings.connectViaOauth')}</div></div>
      {#if atLimit}
        <Button variant="secondary" size="sm" href={billingPath($page.params.projectId ?? '')}>{$_('app.settings.connect')}</Button>
      {:else}
        <Button variant="secondary" size="sm" href={`${base}/settings/connect/${p.key}`} target="_blank" rel="noopener" onclick={() => (pendingConnect = true)}>{$_('app.settings.connect')}</Button>
      {/if}
    </div>
  {/each}
</Panel>

<style>
  .acct {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .glyph {
    width: 34px;
    height: 34px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
  }
  .glyph svg {
    width: 18px;
    height: 18px;
  }
  .nm {
    flex: 1;
    min-width: 0;
  }
  .nm .h {
    font-size: 14px;
    font-weight: 600;
  }
  .nm .s {
    font-size: 12px;
    color: var(--ink-soft);
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--sh-success);
  }
  .status .d {
    width: 7px;
    height: 7px;
    background: currentColor;
  }
  .disc-confirm {
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
