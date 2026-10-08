<script lang="ts">
  import PageTitle from '$lib/components/PageTitle.svelte';
  import { enhance } from '$app/forms';
  import { publishes } from '$lib/social-publishing';
  import { invalidate } from '$app/navigation';
  import { ArrowLeft, Check, Columns2, Download, CalendarPlus, RotateCcw, X, ChevronLeft, ChevronRight } from '@lucide/svelte';
  import PageHead from '$lib/components/PageHead.svelte';
  import CreditAmount from '$lib/components/CreditAmount.svelte';
  import { createSupabaseBrowserClient } from '$lib/supabase/client';
  import { watchBatch } from '$lib/realtime/batch-channel';
  import { Approval, failureText, ItemStatus } from '$lib/studio/batch-state';

  let { data, form } = $props();

  const POLL_MS = 5000;
  const PENDING: readonly string[] = [ItemStatus.Queued, ItemStatus.Running];
  const UNMADE: readonly string[] = [ItemStatus.Failed, ItemStatus.Blocked, ItemStatus.Cancelled];
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const dependency = $derived(`studio:batch:${data.batch.id}`);
  const total = $derived(data.items.length);
  const ready = $derived(data.items.filter((i) => i.status === ItemStatus.Done));
  const pending = $derived(data.items.filter((i) => PENDING.includes(i.status)).length);
  const queued = $derived(data.items.some((i) => i.status === ItemStatus.Queued));
  const unmade = $derived(data.items.filter((i) => UNMADE.includes(i.status)));
  const retryable = $derived(unmade.filter((i) => i.status !== ItemStatus.Blocked));
  const picked = $derived(ready.filter((i) => i.approval === Approval.Approved));
  const previewOnly = $derived(data.items.length > 0 && data.items.every((i) => i.preview));
  const failure = $derived(form && 'error' in form ? String(form.error) : null);
  const posted = $derived(form && 'post' in form ? (form.post as { href: string }) : null);
  const unmadeText = $derived(unmade[0]?.error ? failureText(unmade[0].error) : null);

  let comparing = $state<number | null>(null);
  let calendarOpen = $state(false);
  let more = $state(1);
  let draining = false;

  const compared = $derived(comparing === null ? null : ready[comparing] ?? null);

  async function drain() {
    if (draining) {
      return;
    }
    draining = true;
    try {
      await fetch('?/drain', { method: 'POST', body: new FormData(), headers: { 'x-sveltekit-action': 'true' } });
    } finally {
      draining = false;
      await invalidate(dependency);
    }
  }

  $effect(() => {
    if (queued) {
      void drain();
    }
  });

  $effect(() => {
    const stop = watchBatch(createSupabaseBrowserClient(), data.batch.id, () => void invalidate(dependency));
    return stop;
  });

  $effect(() => {
    if (!pending) {
      return;
    }
    const timer = setInterval(() => void (queued ? drain() : invalidate(dependency)), POLL_MS);
    return () => clearInterval(timer);
  });

  function step(delta: number) {
    if (comparing === null || !ready.length) {
      return;
    }
    comparing = (comparing + delta + ready.length) % ready.length;
  }

  function onkey(e: KeyboardEvent) {
    if (comparing === null) {
      return;
    }
    const moves: Record<string, () => void> = { Escape: () => (comparing = null), ArrowLeft: () => step(-1), ArrowRight: () => step(1) };
    moves[e.key]?.();
  }
</script>

<svelte:window onkeydown={onkey} />

<PageHead title={data.batch.name} />

<div class="batch" data-testid="studio-batch">
  <header>
    <a class="back" href={`/app/studio?project=${data.projectId}`}><ArrowLeft size={16} /> New photos</a>
    <PageTitle text={data.batch.name} />
    {#if data.batch.canvasId}<a class="quiet" href={`/p/${data.projectId}/c/${data.batch.canvasId}`}>Open on the canvas</a>{/if}
  </header>

  {#if pending}
    <section class="progress" aria-live="polite" data-testid="studio-progress">
      <p><strong>Making your photos… {ready.length} of {total} ready.</strong> You can leave this page: they keep coming.</p>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax={total} aria-valuenow={ready.length}><span style={`width: ${total ? (ready.length / total) * 100 : 0}%`}></span></div>
      <form method="POST" action="?/cancel" use:enhance><button type="submit" class="link">Stop the rest</button></form>
    </section>
  {:else if ready.length}
    <p class="hint" data-testid="studio-ready">{ready.length} photo{ready.length === 1 ? '' : 's'} ready. Tap the ones you like, then download or schedule them.</p>
  {/if}

  {#if previewOnly && !pending}
    <section class="notice">
      <p>These are quick previews. Make the full set in high quality{data.perImage ? `, ${data.perImage} credits per photo` : ''}.</p>
      <form method="POST" action="?/run" use:enhance><button class="primary" type="submit">Make the full set</button></form>
    </section>
  {/if}

  {#if unmade.length}
    <section class="unmade" role="alert" data-testid="studio-unmade">
      <p><strong>{unmade.length} photo{unmade.length === 1 ? '' : 's'} could not be made.</strong> {unmadeText?.problem ?? ''} {unmadeText?.fix ?? ''}</p>
      {#if retryable.length}
        <form method="POST" action="?/retry" use:enhance>
          {#each retryable as item (item.id)}<input type="hidden" name="itemId" value={item.id} />{/each}
          <button type="submit"><RotateCcw size={14} /> Try again</button>
        </form>
      {/if}
    </section>
  {/if}

  {#if failure}<p class="error" role="alert">{failure}</p>{/if}

  <div class="grid" data-testid="studio-grid">
    {#each data.items as item (item.id)}
      {@const isPicked = item.approval === Approval.Approved}
      <figure class="cell" class:picked={isPicked} data-status={item.status}>
        {#if item.status === ItemStatus.Done && item.url}
          <form method="POST" action={isPicked ? '?/reject' : '?/approve'} use:enhance>
            <input type="hidden" name="itemId" value={item.id} />
            <button type="submit" class="photo" aria-pressed={isPicked} aria-label={`${isPicked ? 'Unpick' : 'Pick'} ${item.environment} photo`}>
              <img src={item.url} alt={`${item.productTitle}, ${item.environment}`} loading="lazy" />
              <span class="tick" class:on={isPicked}><Check size={16} /></span>
            </button>
          </form>
        {:else if PENDING.includes(item.status)}
          <div class="slot making">{item.status === ItemStatus.Running ? 'Making…' : 'Waiting…'}</div>
        {:else}
          <div class="slot">Not made</div>
        {/if}
        <figcaption>
          <span>{item.environment}{item.model ? ` · ${item.model}` : ''}</span>
          {#if item.status === ItemStatus.Done}
            <span class="tools">
              <button type="button" class="icon" aria-label="Compare with the original" onclick={() => (comparing = ready.findIndex((r) => r.id === item.id))}><Columns2 size={16} /></button>
              <form method="POST" action="?/regenerate" use:enhance><input type="hidden" name="itemId" value={item.id} /><button type="submit" class="icon" aria-label="Make this one again"><RotateCcw size={16} /></button></form>
            </span>
          {/if}
        </figcaption>
      </figure>
    {/each}
  </div>

  {#if !pending && ready.length}
    <form method="POST" action="?/more" use:enhance class="more">
      <span>Want more choice?</span>
      <select name="variations" bind:value={more} aria-label="How many more versions">
        {#each [1, 2, 3, 4] as n (n)}<option value={n}>{n} more of each</option>{/each}
      </select>
      <button type="submit">Make more</button>
      {#if data.perImage}<span class="muted"><CreditAmount amount={data.perImage} /> per photo</span>{/if}
    </form>
  {/if}

  <footer class="actions" data-testid="studio-actions">
    <span class="count">{picked.length ? `${picked.length} picked` : 'Tap photos to pick them'}</span>
    <div class="downloads">
      <Download size={16} />
      {#each data.marketplaces as m (m.id)}
        <a class="button" class:disabled={!picked.length} aria-disabled={!picked.length} href={picked.length ? `/app/studio/${data.batch.id}/zip?format=${m.id}` : undefined} download title={m.size} data-testid={`studio-download-${m.id}`}>{m.label}</a>
      {/each}
      <a class="button" class:disabled={!picked.length} aria-disabled={!picked.length} href={picked.length ? `/app/studio/${data.batch.id}/zip` : undefined} download>Original</a>
    </div>
    {#if publishes(data.socialPublishing)}
      <button type="button" class="primary" disabled={!picked.length} onclick={() => (calendarOpen = !calendarOpen)}><CalendarPlus size={16} /> Add to calendar</button>
    {/if}
  </footer>

  {#if calendarOpen && publishes(data.socialPublishing)}
    <section class="calendar" data-testid="studio-calendar">
      {#if posted}
        <p>Added as a draft post. <a href={posted.href}>Open the calendar</a></p>
      {:else if data.brands.length}
        <form method="POST" action="?/calendar" use:enhance>
          <label>Brand <select name="brand_id">{#each data.brands as b (b.id)}<option value={b.id}>{b.name}</option>{/each}</select></label>
          <label>Day <input type="date" name="date" value={tomorrow} min={new Date().toISOString().slice(0, 10)} /></label>
          <button type="submit" class="primary">Add {picked.length} photo{picked.length === 1 ? '' : 's'}</button>
        </form>
      {:else}
        <p>The calendar publishes for a brand. <a href={`/p/${data.projectId}/brands/new`}>Create your brand</a> first, then come back.</p>
      {/if}
    </section>
  {/if}
</div>

{#if compared}
  <div class="compare" role="dialog" aria-modal="true" aria-label="Compare with the original" data-testid="studio-compare">
    <div class="compare-bar">
      <span>{compared.environment} · {(comparing ?? 0) + 1} of {ready.length}</span>
      <button type="button" class="icon" aria-label="Close" onclick={() => (comparing = null)}><X size={18} /></button>
    </div>
    <div class="pair">
      <figure><figcaption>Your photo</figcaption>{#if compared.original}<img src={compared.original} alt="Original" />{:else}<div class="slot">No original</div>{/if}</figure>
      <figure><figcaption>New</figcaption><img src={compared.url} alt={compared.environment} /></figure>
    </div>
    <div class="compare-bar">
      <button type="button" class="icon" aria-label="Previous" onclick={() => step(-1)}><ChevronLeft size={18} /></button>
      <form method="POST" action={compared.approval === Approval.Approved ? '?/reject' : '?/approve'} use:enhance>
        <input type="hidden" name="itemId" value={compared.id} />
        <button type="submit" class="primary">{compared.approval === Approval.Approved ? 'Unpick' : 'Pick this one'}</button>
      </form>
      <button type="button" class="icon" aria-label="Next" onclick={() => step(1)}><ChevronRight size={18} /></button>
    </div>
  </div>
{/if}

<style>
  .batch {
    max-width: 1100px;
    margin: 0 auto;
    padding: var(--ui-space-4) var(--ui-space-4) 120px;
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-4);
    color: var(--ui-ink);
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--ui-space-2) var(--ui-space-4);
  }
  header > :global(h1) {
    flex: 1 1 100%;
    order: 2;
  }
  .back,
  .quiet {
    display: inline-flex;
    align-items: center;
    gap: var(--ui-space-1);
    color: var(--ui-ink-2);
    font-size: var(--ui-text-sm);
  }
  .quiet {
    margin-left: auto;
  }
  .progress,
  .notice,
  .unmade,
  .calendar {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ui-space-2);
    padding: var(--ui-space-4);
    border: 1px solid var(--ui-line);
    background: var(--ui-surface);
    font-size: var(--ui-text-md);
  }
  .unmade {
    border-color: var(--ui-danger);
  }
  section p,
  .hint {
    margin: 0;
    font-size: var(--ui-text-md);
  }
  .hint {
    color: var(--ui-ink-2);
  }
  .bar {
    width: 100%;
    height: 6px;
    background: var(--ui-line);
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--ui-accent);
    transition: width 0.4s ease;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--ui-space-2);
  }
  @media (min-width: 720px) {
    .grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  .cell {
    margin: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
  }
  .cell.picked {
    border-color: var(--ui-accent);
    outline: 1px solid var(--ui-accent);
    outline-offset: -2px;
  }
  .photo {
    position: relative;
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }
  .photo img,
  .slot {
    display: block;
    width: 100%;
    aspect-ratio: 3 / 4;
    object-fit: cover;
  }
  .slot {
    display: grid;
    place-items: center;
    background: var(--ui-surface);
    color: var(--ui-ink-3);
    font-size: var(--ui-text-sm);
  }
  .making {
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.5;
    }
  }
  .tick {
    position: absolute;
    top: var(--ui-space-2);
    right: var(--ui-space-2);
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
    color: transparent;
  }
  .tick.on {
    background: var(--ui-accent);
    border-color: var(--ui-accent);
    color: var(--ui-accent-ink);
  }
  figcaption {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ui-space-1);
    padding: var(--ui-space-1) var(--ui-space-2);
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-2);
  }
  figcaption > span:first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tools {
    display: flex;
  }
  .icon {
    display: inline-grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ui-ink-2);
    cursor: pointer;
  }
  .icon:hover {
    background: var(--ui-hover);
    color: var(--ui-ink);
  }
  button,
  .button,
  select,
  input {
    min-height: 36px;
    padding: 0 var(--ui-space-3);
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font-size: var(--ui-text-md);
    font-family: inherit;
  }
  button,
  .button {
    display: inline-flex;
    align-items: center;
    gap: var(--ui-space-1);
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }
  .primary {
    background: var(--ui-accent);
    border-color: var(--ui-accent);
    color: var(--ui-accent-ink);
  }
  button:disabled,
  .button.disabled {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none;
  }
  .link {
    min-height: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ui-ink-2);
    font-weight: 400;
    text-decoration: underline;
  }
  .more {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ui-space-2);
    font-size: var(--ui-text-md);
  }
  .muted {
    color: var(--ui-ink-3);
    font-size: var(--ui-text-sm);
  }
  .actions {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--ui-space-2) var(--ui-space-4);
    padding: var(--ui-space-3) var(--ui-space-4);
    border-top: 1px solid var(--ui-line);
    background: var(--ui-bg);
  }
  .count {
    font-size: var(--ui-text-md);
    font-weight: 600;
  }
  .downloads {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ui-space-1);
    color: var(--ui-ink-2);
  }
  .calendar form {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--ui-space-3);
  }
  .calendar label {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-1);
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-2);
  }
  .error {
    margin: 0;
    color: var(--ui-danger);
    font-size: var(--ui-text-md);
  }
  .compare {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    background: var(--ui-bg);
  }
  .compare-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ui-space-2);
    padding: var(--ui-space-2) var(--ui-space-4);
    font-size: var(--ui-text-md);
  }
  .pair {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--ui-space-2);
    padding: 0 var(--ui-space-4);
  }
  @media (max-width: 640px) {
    .pair {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 1fr;
    }
  }
  .pair figure {
    margin: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-1);
    background: var(--ui-surface);
  }
  .pair figcaption {
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    text-transform: uppercase;
  }
  .pair img,
  .pair .slot {
    flex: 1;
    min-height: 0;
    width: 100%;
    object-fit: contain;
    aspect-ratio: auto;
  }
</style>
