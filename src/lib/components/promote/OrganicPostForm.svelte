<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import PlatformGlyph from '$lib/components/PlatformGlyph.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Select } from '$lib/components/ui/select';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Input } from '$lib/components/ui/input';
  import { Notice } from '$lib/components/ui/notice';
  import { postCompositionFor } from '$lib/canvas/post-composition';
  import {
    moveMediaUp,
    moveMediaDown,
    removeMedia,
    defaultScheduleTime,
    saveReasonFor,
    scheduleReasonFor,
    submittedNodeIds,
    submitErrorFor,
    type SubmitOutcome
  } from '$lib/canvas/create-post-composer';
  import { closeSheet } from '$lib/canvas/sheet-nav';

  type OrganicData = {
    nodes: { id: string; type: string; data: Record<string, unknown>; text: string | null; mediaUrl: string | null }[];
    brands: { id: string; name: string }[];
    accountsByBrand: Record<string, { id: string; platform: string; handle: string | null; displayName: string | null }[]>;
    projectBrandId: string | null;
    canvasId: string | null;
  };

  let { data, form = null }: { data: OrganicData; form?: unknown } = $props();

  const projectId = $derived(page.params.projectId);
  const composition = $derived(postCompositionFor(data.nodes));

  let mediaOrder = $state(composition.media.map((m) => m.nodeId));

  const mediaNodes = $derived(
    mediaOrder
      .map((id) => data.nodes.find((n) => n.id === id))
      .filter((n): n is (typeof data.nodes)[number] => !!n)
  );

  let captionPick = $state(composition.captions[0]?.nodeId ?? null);
  let caption = $state(composition.captions[0]?.text ?? '');

  function pickCaption(nodeId: string) {
    captionPick = nodeId;
    const found = composition.captions.find((c) => c.nodeId === nodeId);
    if (found) caption = found.text;
  }

  let selectedBrandId = $state(data.projectBrandId ?? data.brands[0]?.id ?? '');

  const accountsForBrand = $derived(data.accountsByBrand[selectedBrandId] ?? []);
  let selectedAccountIds = $state<string[]>([]);

  function toggleAccount(accountId: string) {
    selectedAccountIds = selectedAccountIds.includes(accountId)
      ? selectedAccountIds.filter((id) => id !== accountId)
      : [...selectedAccountIds, accountId];
  }

  let scheduling = $state(false);
  let scheduledForLocal = $state(defaultScheduleTime(new Date()));
  let scheduledForIso = $derived(scheduledForLocal ? new Date(scheduledForLocal).toISOString() : '');

  const readiness = $derived({
    hasBrand: !!selectedBrandId,
    hasContent: composition.enabled,
    hasConnectedAccounts: selectedAccountIds.length > 0
  });

  const saveDisabledReason = $derived(saveReasonFor(readiness));
  const scheduleDisabledReason = $derived(scheduleReasonFor(readiness));
  const disabledReasons = $derived([...new Set([saveDisabledReason, scheduleDisabledReason].filter((r): r is string => !!r))]);

  const formAction = $derived(data.canvasId ? `/p/${projectId}/c/${data.canvasId}?/create_post` : '');

  let submitting = $state(false);
  let submitOutcome = $state<SubmitOutcome>((form as SubmitOutcome) ?? null);
  const submitError = $derived(submitErrorFor(submitOutcome));
</script>

<div class="composer">
  {#if form && typeof form === 'object' && 'post' in form && form.post}
    <Notice tone="success">
      Post saved. <Button variant="link" href={`/p/${projectId}/calendar`}>Open calendar</Button>
    </Notice>
  {/if}

  <form
    method="POST"
    action={formAction}
    use:enhance={() => {
      submitting = true;
      submitOutcome = null;
      return async ({ result, update }) => {
        submitting = false;
        if (result.type === 'error') {
          submitOutcome = 'server';
          return;
        }
        if (result.type === 'redirect') {
          await update();
          return;
        }
        submitOutcome = (result.data as SubmitOutcome) ?? null;
        if (result.type === 'success' && result.data?.post) {
          await update();
          closeSheet();
          return;
        }
        await update();
      };
    }}
  >
    <input type="hidden" name="brand_id" value={selectedBrandId} />
    <input type="hidden" name="caption" value={caption} />
    {#each submittedNodeIds(mediaOrder, composition.captions.map((c) => c.nodeId)) as nodeId (nodeId)}
      <input type="hidden" name="node_id" value={nodeId} />
    {/each}
    {#each mediaOrder as nodeId (nodeId)}
      <input type="hidden" name="media_order_node_id" value={nodeId} />
    {/each}
    {#each selectedAccountIds as accountId (accountId)}
      <input type="hidden" name="account_id" value={accountId} />
    {/each}
    {#if scheduling}
      <input type="hidden" name="scheduled_for" value={scheduledForIso} />
    {/if}

    <section class="media-section">
      <h2>Media</h2>
      {#if !mediaNodes.length}
        <p class="empty">No media in this selection.</p>
      {/if}
      <ul class="media-list">
        {#each mediaNodes as node, i (node.id)}
          <li class="media-row">
            {#if node.mediaUrl}
              {#if node.type === 'video'}
                <video src={node.mediaUrl} muted></video>
              {:else}
                <img src={node.mediaUrl} alt="" />
              {/if}
            {/if}
            <div class="media-controls">
              <button
                type="button"
                class="icon-btn"
                disabled={i === 0}
                title="Move up"
                aria-label="Move up"
                onclick={() => (mediaOrder = moveMediaUp(mediaOrder, node.id))}
              >
                <ArrowUp size={14} strokeWidth={2} />
              </button>
              <button
                type="button"
                class="icon-btn"
                disabled={i === mediaNodes.length - 1}
                title="Move down"
                aria-label="Move down"
                onclick={() => (mediaOrder = moveMediaDown(mediaOrder, node.id))}
              >
                <ArrowDown size={14} strokeWidth={2} />
              </button>
              <button
                type="button"
                class="icon-btn"
                title="Remove"
                aria-label="Remove"
                onclick={() => (mediaOrder = removeMedia(mediaOrder, node.id))}
              >
                <Trash2 size={14} strokeWidth={2} />
              </button>
            </div>
          </li>
        {/each}
      </ul>
    </section>

    <section class="caption-section">
      <h2>Caption</h2>
      {#if composition.captions.length > 1}
        <div class="caption-picks">
          {#each composition.captions as candidate (candidate.nodeId)}
            <label class="caption-pick">
              <input
                type="radio"
                name="caption_pick"
                checked={captionPick === candidate.nodeId}
                onchange={() => pickCaption(candidate.nodeId)}
              />
              <span>{candidate.text}</span>
            </label>
          {/each}
        </div>
      {/if}
      <Textarea bind:value={caption} rows={4} placeholder="Write a caption…" />
    </section>

    <section class="brand-section">
      <h2>Brand</h2>
      {#if data.brands.length > 1}
        <Select bind:value={selectedBrandId} class="max-w-xs" aria-label="Brand">
          {#each data.brands as brand (brand.id)}
            <option value={brand.id}>{brand.name}</option>
          {/each}
        </Select>
      {:else if data.brands.length === 1}
        <p>{data.brands[0].name}</p>
      {:else}
        <p class="empty">
          No brand yet.
          <Button variant="link" href={`/p/${projectId}/brands/new`}>Create a brand</Button>
        </p>
      {/if}
    </section>

    <section class="accounts-section">
      <h2>Accounts</h2>
      {#if accountsForBrand.length}
        <ul class="accounts-list">
          {#each accountsForBrand as account (account.id)}
            <li>
              <label class="account-row">
                <input
                  type="checkbox"
                  checked={selectedAccountIds.includes(account.id)}
                  onchange={() => toggleAccount(account.id)}
                />
                <PlatformGlyph platform={account.platform} />
                <span>{account.handle ?? account.displayName ?? account.platform}</span>
              </label>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">
          No connected accounts.
          <Button variant="link" href={`/p/${projectId}/settings/connected-accounts`}>Connect one</Button>
        </p>
      {/if}
    </section>

    {#if scheduling}
      <section class="schedule-section">
        <label>
          Schedule for
          <Input type="datetime-local" bind:value={scheduledForLocal} class="h-9 max-w-xs" />
        </label>
      </section>
    {/if}

    {#if submitError}
      <Notice tone="error">{submitError}</Notice>
    {/if}

    <footer class="composer-footer">
      <div class="footer-actions">
        <Button variant="secondary" type="submit" disabled={!!saveDisabledReason || submitting}>
          {submitting ? 'Saving…' : 'Save as draft'}
        </Button>
        {#if !scheduling}
          <Button disabled={!!scheduleDisabledReason || submitting} onclick={() => (scheduling = true)}>
            Approve and schedule
          </Button>
        {:else}
          <Button type="submit" disabled={!!scheduleDisabledReason || submitting}>
            {submitting ? 'Scheduling…' : 'Approve and schedule'}
          </Button>
        {/if}
      </div>
      {#each disabledReasons as reason (reason)}
        <p class="reason">{reason}</p>
      {/each}
    </footer>
  </form>
</div>

<style>
  .composer {
    max-width: 640px;
  }

  section {
    margin-bottom: 24px;
  }

  section h2 {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ink-soft, #6e6e73);
    margin: 0 0 8px;
  }

  .empty {
    color: var(--ink-faint, #9a9a9e);
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .media-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .media-row {
    display: flex;
    align-items: center;
    gap: 12px;
    border: 1px solid var(--line, #e5e5e5);
    padding: 8px;
  }

  .media-row img,
  .media-row video {
    width: 64px;
    height: 64px;
    object-fit: cover;
  }

  .media-controls {
    display: flex;
    gap: 6px;
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: 1px solid var(--line, #e5e5e5);
    background: transparent;
    color: var(--ink-soft, #6e6e73);
    cursor: pointer;
  }

  .icon-btn:hover:not(:disabled) {
    color: var(--ink, #1d1d1f);
    background: var(--paper-2, #f9f9f9);
  }

  .icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .caption-picks {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 8px;
  }

  .caption-pick {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
  }

  .accounts-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .account-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }

  .schedule-section label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
  }

  .composer-footer {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .footer-actions {
    display: flex;
    gap: 8px;
  }

  :global([data-viewport='mobile']) .footer-actions {
    flex-direction: column;
  }
  :global([data-viewport='mobile']) .footer-actions :global(button) {
    width: 100%;
    min-height: var(--touch-target);
  }

  .reason {
    margin: 0;
    font-size: 12px;
    color: var(--ink-faint, #9a9a9e);
  }

</style>
