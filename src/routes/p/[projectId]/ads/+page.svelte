<script lang="ts">
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import { page } from '$app/state';
  import PageHead from '$lib/components/PageHead.svelte';
  import { openSheet } from '$lib/canvas/sheet-nav';
  import { promotePath } from '$lib/canvas/promote-sheet';
  import { actionsFor, STATUS_LABELS } from '$lib/ads/campaign-actions';
  import { OBJECTIVES, PLACEMENTS } from '$lib/ads/paid-ad';
  import { feeBreakdown } from '$lib/ads-fee';
  import type { PageData } from './$types';

  let { data, form = null }: { data: PageData; form?: unknown } = $props();

  const view = $derived(data.state);
  const projectId = $derived(page.params.projectId ?? '');
  type ActionFailure = { error?: unknown; detail?: unknown };
  let failure = $state<ActionFailure | null>(null);
  const actionError = $derived.by(() => {
    const f = failure ?? (form as ActionFailure | null);
    return f && f.error ? String(f.detail ?? f.error) : null;
  });

  const refresh: SubmitFunction = () => async ({ result, update }) => {
    failure = result.type === 'failure' ? ((result.data as ActionFailure) ?? null) : null;
    if (page.state.sheet) {
      await openSheet(projectId, '/ads', 'replace');
      return;
    }
    await update();
  };

  const objectiveLabel = (id: string) => OBJECTIVES.find((o) => o.id === id)?.label ?? id;
  const placementLabels = (ids: string[]) =>
    ids.map((id) => PLACEMENTS.find((p) => p.id === id)?.label ?? id).join(', ') || 'Automatic';
  const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');
  const currencyOf = (adAccountId: string) =>
    view.kind === 'ready' ? (view.adAccounts.find((a) => a.id === adAccountId)?.currency ?? '') : '';
  const budgetLine = (c: { budgetAmount: number; budgetType: string; adAccountId: string }) =>
    `${c.budgetAmount} ${currencyOf(c.adAccountId)} ${c.budgetType === 'daily' ? '/ day' : 'total'}`;
</script>

<PageHead title="Ads" subtitle={view.kind === 'no_brand' ? 'Meta · Facebook and Instagram' : `${view.brand.name} · Meta`} />

<div class="content">
  {#if data.syncResult && !data.syncResult.ok}
    <p class="banner err">Connect the brand's Facebook page first, then connect Meta ads.</p>
  {/if}

  {#if view.kind === 'no_brand'}
    <section class="gate">
      <h2>No brand on this project</h2>
      <p>Ads run for a brand. Create or pick one first.</p>
      <a class="btn primary" href={`/p/${projectId}/brands/new`}>Create a brand</a>
    </section>
  {:else if view.kind === 'no_ad_account'}
    <section class="gate" data-testid="connect-meta-cta">
      <h2>Connect a Meta ad account</h2>
      <p>{view.brand.name} needs a Meta ad account to run ads on Facebook and Instagram. It uses the brand's Facebook connection.</p>
      <a class="btn primary" href={`/p/${projectId}/ads/connect`} data-sveltekit-reload>Connect Meta ads</a>
    </section>
  {:else}
    <section class="head-row">
      <p class="muted">
        {view.adAccounts.length} ad account{view.adAccounts.length === 1 ? '' : 's'} ·
        {view.adAccounts.map((a) => a.name ?? a.id).join(', ')}
      </p>
      <button class="btn primary" type="button" onclick={() => openSheet(projectId, promotePath([], 'paid'), 'replace')}>
        New ad
      </button>
    </section>

    {#if actionError}<p class="banner err" role="alert">{actionError}</p>{/if}

    {#if view.campaigns.length === 0}
      <section class="gate">
        <h2>No campaigns yet</h2>
        <p>Select images or videos on a canvas and press Promote, or boost a published post.</p>
      </section>
    {:else}
      <ul class="campaigns" data-testid="campaigns">
        {#each view.campaigns as c (c.id)}
          {@const fee = feeBreakdown(c.budgetAmount)}
          <li class="campaign">
            <div class="top">
              <b class="name">{c.name}</b>
              <span class="status s-{c.status}">{STATUS_LABELS[c.status]}</span>
            </div>
            <dl>
              <dt>Objective</dt><dd>{objectiveLabel(c.objective)}</dd>
              <dt>Budget</dt><dd>{budgetLine(c)}</dd>
              <dt>Dates</dt><dd>{day(c.startsAt)} → {day(c.endsAt)}</dd>
              <dt>Placements</dt><dd>{placementLabels(c.placements)}</dd>
              <dt>Audience</dt><dd>{(c.targeting?.countries ?? []).join(', ') || '—'} · {c.targeting?.age_min ?? 18}–{c.targeting?.age_max ?? 65}</dd>
              <dt>Results</dt><dd class="muted">Metrics sync is not available yet</dd>
            </dl>
            {#if c.error}<p class="err">{c.error}</p>{/if}
            {#if actionsFor(c.status).length}
              <div class="actions">
                {#each actionsFor(c.status) as action (action.id)}
                  <form method="POST" action={`/p/${projectId}/ads?/${action.id}`} use:enhance={refresh}>
                    <input type="hidden" name="campaign_id" value={c.id} />
                    <button class="btn" class:primary={action.primary} type="submit" data-action={action.id}>{action.label}</button>
                  </form>
                {/each}
                {#if actionsFor(c.status).some((a) => a.spends)}
                  <p class="muted fee">
                    {Math.round(fee.feeRate * 100)}% fee on spend: {fee.fee.toFixed(2)} {currencyOf(c.adAccountId)} of it is charged in credits at launch. Spend is billed by Meta.
                  </p>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  .content { display: flex; flex-direction: column; gap: 16px; padding: 16px 22px 32px; max-width: 880px; }
  .gate { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 28px 24px; border: 1px solid var(--line); max-width: 520px; }
  .gate h2 { margin: 0; font-size: 1.05rem; font-weight: 650; }
  .gate p, .muted { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--muted, #6e6e73); }
  .head-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .campaigns { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .campaign { border: 1px solid var(--line); padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
  .top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .name { font-size: 14.5px; }
  .status { font-size: 11.5px; font-weight: 600; padding: 3px 8px; border: 1px solid var(--line); white-space: nowrap; }
  .s-active { background: var(--success-bg, #e8f5e9); color: var(--success, #1b6b30); border-color: transparent; }
  .s-failed, .s-rejected { background: var(--danger-bg, #fdeceb); color: var(--danger, #b3261e); border-color: transparent; }
  .s-draft, .s-pending_review { background: var(--paper-2, #f5f5f7); }
  dl { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 4px 12px; margin: 0; font-size: 13px; }
  dt { color: var(--muted, #6e6e73); }
  dd { margin: 0; overflow-wrap: anywhere; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .fee { flex-basis: 100%; font-size: 12px; }
  .err { margin: 0; font-size: 12.5px; color: var(--danger, #b3261e); }
  .banner { margin: 0; padding: 10px 12px; font-size: 13px; }
  .banner.err { background: var(--danger-bg, #fdeceb); }
  .btn { display: inline-flex; align-items: center; height: 36px; padding: 0 14px; font: inherit; font-size: 13px; font-weight: 600; text-decoration: none; border: 1px solid var(--line); background: var(--paper, #fff); color: var(--ink); cursor: pointer; }
  .btn.primary { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  :global([data-viewport='mobile']) .content { padding: 12px var(--page-gutter, 16px) 32px; }
  :global([data-viewport='mobile']) .btn { min-height: var(--touch-target, 44px); }
  @media (max-width: 480px) { dl { grid-template-columns: 1fr; } dt { margin-top: 4px; } }
</style>
