<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { sendJson } from '$lib/dashboard/api';
  import { assignableRoles, can, OrgAction, OrgRoleName, type OrgRole } from '$lib/org-roles';
  import { Panel } from '$lib/components/ui/panel';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import { Notice } from '$lib/components/ui/notice';
  import PageHead from '$lib/components/PageHead.svelte';
  import PageTitle from '$lib/components/PageTitle.svelte';

  let { data } = $props();

  const team = $derived(data.team);
  const mayInvite = $derived(can(team.role, OrgAction.Invite));
  const mayManage = $derived(can(team.role, OrgAction.ManageMembers));
  const mayTransfer = $derived(can(team.role, OrgAction.TransferOwnership));
  const roles = $derived(assignableRoles(team.role));

  let email = $state('');
  let inviteRole = $state<OrgRole>(OrgRoleName.Member);
  let notice = $state<{ tone: 'success' | 'error'; text: string } | null>(null);
  let link = $state<string | null>(null);

  async function op(body: Record<string, unknown>, success: string): Promise<Record<string, unknown> | null> {
    const sent = await sendJson(`/api/v1/orgs/${data.orgId}/team`, 'POST', body);
    if (!sent.ok) {
      notice = { tone: 'error', text: String(sent.body.message ?? sent.body.error ?? 'Something went wrong') };
      return null;
    }
    notice = { tone: 'success', text: success };
    await invalidateAll();
    return sent.body;
  }

  async function invite(e: SubmitEvent) {
    e.preventDefault();
    const done = await op({ op: 'invite', email, role: inviteRole }, `Invite sent to ${email}.`);
    if (done) {
      email = '';
    }
  }

  async function makeLink() {
    const done = await op({ op: 'invite_link' }, 'New invite link. The old one no longer works.');
    link = done ? String(done.url) : null;
  }

  async function leave() {
    if (await op({ op: 'leave' }, `You left ${data.orgName}.`)) {
      await goto('/app', { invalidateAll: true });
    }
  }

  async function transfer(userId: string, who: string) {
    if (confirm(`Make ${who} the owner? You become an admin.`)) {
      await op({ op: 'transfer_ownership', user_id: userId }, `${who} is now the owner.`);
    }
  }
</script>

<PageHead title="Team" subtitle={data.orgName} />
<PageTitle text="Team" />

{#if notice}<Notice tone={notice.tone}>{notice.text}</Notice>{/if}

{#if mayInvite}
  <Panel title="Invite" description="Viewers see everything and change nothing. Editors (members, admins) work on canvases and spend credits.">
    <form class="flex gap-2" onsubmit={invite} data-testid="team-invite">
      <Input type="email" required placeholder="name@company.com" bind:value={email} class="h-9" />
      <select bind:value={inviteRole} class="h-9" aria-label="Role">
        {#each roles as role (role)}<option value={role}>{role}</option>{/each}
      </select>
      <Button type="submit">Send invite</Button>
    </form>

    <div class="flex flex-wrap items-center gap-2">
      <Button variant="ghost" size="sm" onclick={makeLink} data-testid="team-link">{team.linkActive ? 'Reset invite link' : 'Create invite link'}</Button>
      {#if team.linkActive}
        <Button variant="ghost" size="sm" onclick={() => op({ op: 'disable_invite_link' }, 'Invite link turned off.')}>Turn off link</Button>
      {/if}
      {#if link}<code class="truncate text-[0.8125rem]" data-testid="team-link-url">{link}</code>{/if}
    </div>
    <p class="m-0 text-[0.8125rem] text-muted-foreground">Anyone with the link joins as a viewer. It is shown once; reset it to get a new one.</p>

    {#each team.invites as inv (inv.id)}
      <div class="flex items-center justify-between gap-3" data-testid="team-invite-row">
        <div class="min-w-0">
          <p class="m-0 truncate text-sm font-semibold">{inv.email}</p>
          <p class="m-0 text-[0.8125rem] text-muted-foreground">Invited as {inv.role}</p>
        </div>
        <div class="flex gap-1">
          <Button variant="ghost" size="sm" onclick={() => op({ op: 'resend_invite', invite_id: inv.id }, `Invite sent again to ${inv.email}.`)}>Resend</Button>
          <Button variant="ghost" size="sm" onclick={() => op({ op: 'revoke_invite', invite_id: inv.id }, 'Invite revoked.')}>Revoke</Button>
        </div>
      </div>
    {/each}
  </Panel>
{/if}

<Panel title="Members">
  {#each team.members as m (m.userId)}
    <div class="flex items-center justify-between gap-3" data-testid="team-member">
      <div class="min-w-0">
        <p class="m-0 truncate text-sm font-semibold">{m.name ?? m.email}</p>
        <p class="m-0 text-[0.8125rem] text-muted-foreground">{m.email}</p>
      </div>
      <div class="flex items-center gap-1">
        {#if mayManage && m.role !== OrgRoleName.Owner}
          <select value={m.role} aria-label="Role" onchange={(e) => op({ op: 'set_role', user_id: m.userId, role: e.currentTarget.value }, 'Role changed.')}>
            {#each roles as role (role)}<option value={role}>{role}</option>{/each}
          </select>
          <Button variant="ghost" size="sm" onclick={() => op({ op: 'remove_member', user_id: m.userId }, `${m.email} removed.`)}>Remove</Button>
        {:else}
          <span class="text-[0.8125rem]">{m.role}</span>
        {/if}
        {#if mayTransfer && m.role !== OrgRoleName.Owner}
          <Button variant="ghost" size="sm" onclick={() => transfer(m.userId, m.email)}>Make owner</Button>
        {/if}
      </div>
    </div>
  {/each}
</Panel>

{#if can(team.role, OrgAction.Leave)}
  <Panel title="Leave organisation" description="You lose access to its projects. An admin can invite you back.">
    <div><Button variant="ghost" onclick={leave} data-testid="team-leave">Leave {data.orgName}</Button></div>
  </Panel>
{/if}
