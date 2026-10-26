<script lang="ts">
  import { enhance } from '$lib/settings/enhance';
  import { _ } from 'svelte-i18n';
  import { Panel } from '$lib/components/ui/panel';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';

  let { data, form } = $props();

  const SCOPES = [
    { scope: 'org_member', label: 'orgMember' },
    { scope: 'project_member', label: 'projectMember' },
    { scope: 'project_total', label: 'projectTotal' }
  ] as const;

  const capOf = (scope: string) => data.caps.find((cap) => cap.scope === scope);
</script>

{#if form?.capError}<Notice tone="error">{$_(`app.settings.spend.${form.capError === 'forbidden' ? 'adminOnly' : form.capError}`)}</Notice>{/if}
{#if form?.capSaved}<Notice tone="success">{$_('app.settings.spend.saved')}</Notice>{/if}
{#if form?.capRemoved}<Notice tone="success">{$_('app.settings.spend.removed')}</Notice>{/if}

<Panel title={$_('app.settings.spend.title')} description={$_('app.settings.spend.subtitle')}>
  {#if !data.canEdit}
    <p class="m-0 text-[0.8125rem] text-muted-foreground">{$_('app.settings.spend.adminOnly')}</p>
  {/if}

  {#each SCOPES as row (row.scope)}
    {@const cap = capOf(row.scope)}
    <form method="POST" action="?/saveCap" use:enhance class="flex flex-wrap items-end gap-3 py-3" data-testid={`cap-${row.scope}`}>
      <input type="hidden" name="scope" value={row.scope} />
      <div class="flex min-w-[14rem] flex-col gap-1">
        <h3 class="m-0 text-[0.875rem] font-medium">{$_(`app.settings.spend.${row.label}`)}</h3>
        <span class="text-[0.75rem] text-muted-foreground">{cap ? `$${cap.capUsd}` : $_('app.settings.spend.none')}</span>
      </div>
      <label class="flex flex-col gap-1 text-[0.75rem]">
        {$_('app.settings.spend.amount')}
        <input type="number" name="cap_usd" min="0.01" step="0.01" value={cap?.capUsd ?? ''} disabled={!data.canEdit} class="w-28 border px-2 py-1" />
      </label>
      <label class="flex flex-col gap-1 text-[0.75rem]">
        {$_('app.settings.spend.reset')}
        <select name="reset" value={cap?.reset ?? 'none'} disabled={!data.canEdit} class="border px-2 py-1">
          <option value="none">{$_('app.settings.spend.resetNone')}</option>
          <option value="monthly">{$_('app.settings.spend.resetMonthly')}</option>
        </select>
      </label>
      {#if data.canEdit}
        <Button size="sm" type="submit">{$_('app.settings.spend.save')}</Button>
        {#if cap}
          <Button size="sm" variant="secondary" type="submit" formaction="?/removeCap">{$_('app.settings.spend.remove')}</Button>
        {/if}
      {/if}
    </form>
  {/each}
</Panel>
