<script lang="ts">
  import { enhance } from '$app/forms';
  import { _ } from 'svelte-i18n';
  import { Panel } from '$lib/components/ui/panel';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';

  let { data, form } = $props();
</script>

{#if form?.teamError}<Notice tone="error">{form.teamError}</Notice>{/if}
{#if form?.teamInvited}<Notice tone="success">{form.emailSent ? $_('app.settings.team.invited') : $_('app.settings.team.invitedNoEmail')}</Notice>{/if}
{#if form?.teamRevoked}<Notice tone="success">{$_('app.settings.team.revoked')}</Notice>{/if}

<Panel title={$_('app.settings.team.title')} description={data.isOwner ? $_('app.settings.team.subtitle') : undefined}>
  {#if !data.isOwner}
    <div><Notice class="mb-0">{$_('app.settings.billing.membersNotice')}</Notice></div>
  {:else}
    <form method="POST" action="?/invite" use:enhance class="flex gap-2">
      <Input type="email" name="email" required placeholder={$_('app.settings.team.emailPlaceholder')} class="h-9" />
      <Button type="submit">{$_('app.settings.team.invite')}</Button>
    </form>

    {#each data.invites as inv (inv.id)}
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="m-0 truncate text-sm font-semibold">{inv.email}</p>
          <p class="m-0 text-[0.8125rem] text-muted-foreground">{inv.accepted_at ? $_('app.settings.team.member') : $_('app.settings.team.pending')}</p>
        </div>
        <form method="POST" action="?/revokeInvite" use:enhance>
          <input type="hidden" name="invite_id" value={inv.id} />
          <Button variant="ghost" size="sm" type="submit">{$_('app.settings.team.revoke')}</Button>
        </form>
      </div>
    {:else}
      <p class="m-0 text-[0.8125rem] text-muted-foreground">{$_('app.settings.team.empty')}</p>
    {/each}
  {/if}
</Panel>
