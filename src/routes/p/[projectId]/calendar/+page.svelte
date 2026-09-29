<script lang="ts">
  import { ChevronLeft, ChevronRight, X } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Select } from '$lib/components/ui/select';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { _ } from 'svelte-i18n';
  import PlatformGlyph from '$lib/components/PlatformGlyph.svelte';
  import PageHead from '$lib/components/PageHead.svelte';
  import { monthGrid, placePosts, type GridDay } from '$lib/calendar/month-grid';
  import { placedInstant } from '$lib/calendar/period-grid';
  import { ALL_BRANDS, type CalendarPost } from './calendar-load';

  const CALENDAR_TIME_ZONE = 'Europe/Rome';

  const CALENDAR_LOCALE = 'en-GB';
  const MONDAY_2024_01_01 = Date.UTC(2024, 0, 1);
  const DAY_MS = 24 * 60 * 60 * 1000;

  const MONTH_NAMES = Array.from({ length: 12 }, (_unused, i) =>
    new Intl.DateTimeFormat(CALENDAR_LOCALE, { month: 'long', timeZone: 'UTC' }).format(Date.UTC(2024, i, 1))
  );

  const WEEKDAY_NAMES = Array.from({ length: 7 }, (_unused, i) =>
    new Intl.DateTimeFormat(CALENDAR_LOCALE, { weekday: 'short', timeZone: 'UTC' }).format(MONDAY_2024_01_01 + i * DAY_MS)
  );

  let { data, form } = $props();

  const NEEDS_ADULT_CONFIRMATION = 'uncensored_needs_confirmation';
  type DeliveryReply = { accountId: string; ok: boolean; error?: string };
  const lastDeliveries = $derived(((form as { result?: { deliveries?: DeliveryReply[] } } | null)?.result?.deliveries ?? []) as DeliveryReply[]);
  const needsAdultConfirmation = $derived(lastDeliveries.some((d) => d.error === NEEDS_ADULT_CONFIRMATION));
  const deliveryErrors = $derived(lastDeliveries.filter((d) => !d.ok && d.error).map((d) => d.error!));

  const BRAND_TONES = ['#1d1d1f', '#7c5cff', '#0a7d5a', '#c2410c', '#0369a1', '#a21caf'];

  const brandsById = $derived(new Map(data.brands.map((b, i) => [b.id, { ...b, tone: BRAND_TONES[i % BRAND_TONES.length] }])));
  const showsAll = $derived(data.selection === ALL_BRANDS);
  const posts = $derived(data.posts as CalendarPost[]);
  const year = $derived(data.month.year);
  const month = $derived(data.month.month);

  const today = new Date();
  const weeks = $derived(monthGrid(year, month, today));

  function scheduledForOf(post: CalendarPost): string | null {
    return placedInstant(post);
  }

  const placed = $derived(
    placePosts(
      posts.map((p) => ({ id: p.id, scheduledFor: scheduledForOf(p) })),
      weeks,
      CALENDAR_TIME_ZONE
    )
  );

  const postsById = $derived(new Map(posts.map((p) => [p.id, p])));

  function postsOnDay(day: GridDay): CalendarPost[] {
    const key = `${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
    return (placed.byDay[key] ?? []).map((id) => postsById.get(id)).filter((p): p is CalendarPost => Boolean(p));
  }

  const unscheduledPosts = $derived(
    placed.unscheduled.map((id) => postsById.get(id)).filter((p): p is CalendarPost => Boolean(p))
  );

  function timeOf(post: CalendarPost): string {
    const at = scheduledForOf(post);
    if (!at) return '';
    return new Intl.DateTimeFormat(CALENDAR_LOCALE, { timeZone: CALENDAR_TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(at));
  }

  function platformsOf(post: CalendarPost): string[] {
    return [...new Set(post.deliveries.map((d) => d.platform))];
  }

  function monthParam(y: number, m: number): string {
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  function navigateMonth(delta: number) {
    let y = year;
    let m = month + delta;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    withParam('month', monthParam(y, m));
  }

  function goToday() {
    withParam('month', monthParam(today.getUTCFullYear(), today.getUTCMonth() + 1));
  }

  function withParam(key: string, value: string) {
    const params = new URLSearchParams(page.url.searchParams);
    params.set(key, value);
    void goto(`?${params}`, { keepFocus: true, noScroll: true });
  }

  function initialsOf(name: string): string {
    return name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  }

  function localInputOf(iso: string | null): string {
    const at = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
  }

  function isoOf(local: string): string {
    return local ? new Date(local).toISOString() : '';
  }

  let scheduleLocal = $state('');

  function undeliveredOf(post: CalendarPost) {
    return (data.accountsByBrand[post.brandId] ?? []).filter((a) => !post.deliveries.some((d) => d.accountId === a.id));
  }

  let selectedPost = $state<CalendarPost | null>(null);
  let brokenLogos = $state(new Set<string>());

  function openPost(post: CalendarPost) {
    selectedPost = post;
    scheduleLocal = localInputOf(scheduledForOf(post));
  }

  function closePost() {
    selectedPost = null;
  }

  function dayKey(day: GridDay): string {
    return `day-${day.year}-${day.month}-${day.day}`;
  }

  const monthDays = $derived(weeks.flat().filter((day) => !day.outside));

  function weekdayOf(day: GridDay): string {
    const sundayFirst = new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay();
    return WEEKDAY_NAMES[(sundayFirst + 6) % 7];
  }

  function jumpTo(day: GridDay) {
    document.getElementById(dayKey(day))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
</script>

{#snippet brandChip(brandId: string)}
  {@const b = brandsById.get(brandId)}
  {#if b}
    {#if b.logoUrl && !brokenLogos.has(b.id)}
      <img class="brand-chip" src={b.logoUrl} alt={b.name} title={b.name} onerror={() => (brokenLogos = new Set(brokenLogos).add(b.id))} />
    {:else}
      <span class="brand-chip" style:background={b.tone} title={b.name}>{initialsOf(b.name)}</span>
    {/if}
  {/if}
{/snippet}

<PageHead title={$_('app.hub.publish.calendar')} />

<div class="calendar-page">
  <header class="page-header">
    <div class="title-row">
      <h1>{MONTH_NAMES[month - 1]} {year}</h1>
      <div class="nav-buttons">
        <Button variant="secondary" size="icon-sm" onclick={() => navigateMonth(-1)} aria-label="Previous month"><ChevronLeft /></Button>
        <Button variant="secondary" size="sm" onclick={goToday}>Today</Button>
        <Button variant="secondary" size="icon-sm" onclick={() => navigateMonth(1)} aria-label="Next month"><ChevronRight /></Button>
      </div>
      {#if data.brands.length}
        <Select
          class="brand-select w-44"
          aria-label="Brand"
          value={data.selection}
          onchange={(e) => withParam('brand', e.currentTarget.value)}
        >
          <option value={ALL_BRANDS}>All brands</option>
          {#each data.brands as b (b.id)}
            <option value={b.slug}>{b.name}</option>
          {/each}
        </Select>
      {/if}
    </div>
  </header>

  <div class="calendar-body" class:has-overlay={!data.brands.length}>
    {#if !data.brands.length}
      <div class="brand-overlay">
        <div class="brand-overlay-box">
          <p class="brand-overlay-title">No brand yet</p>
          <p class="brand-overlay-hint">Create a brand to schedule posts.</p>

          <a class="brand-create-link" href={`/p/${page.params.projectId}/brands/new?returnTo=/p/${page.params.projectId}/calendar`}>
            Create brand
          </a>
        </div>
      </div>
    {/if}
    <div class="grid-wrap">
      <div class="weekday-row">
        {#each WEEKDAY_NAMES as name (name)}
          <div class="weekday-cell">{name}</div>
        {/each}
      </div>

      {#each weeks as week, wi (wi)}
        <div class="week-row">
          {#each week as day (`${day.year}-${day.month}-${day.day}`)}
            {@const dayPosts = postsOnDay(day)}
            <div class="day-cell" class:outside={day.outside} class:is-today={day.isToday}>
              <span class="day-number">{day.day}</span>
              <div class="day-chips">
                {#each dayPosts as post (post.id)}
                  <button type="button" class="post-chip" class:is-draft={!post.deliveries.length} onclick={() => openPost(post)}>
                    {#if showsAll}{@render brandChip(post.brandId)}{/if}
                    {#each platformsOf(post) as platform (platform)}
                      <PlatformGlyph {platform} />
                    {/each}
                    <span class="chip-time">{timeOf(post)}</span>
                    <span class="chip-caption">{post.caption}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </div>

    <section class="agenda" aria-label="Agenda">
      <div class="day-strip">
        {#each monthDays as day (dayKey(day))}
          {@const count = postsOnDay(day).length}
          <button
            type="button"
            class="day-pill"
            class:is-today={day.isToday}
            class:has-posts={count > 0}
            disabled={count === 0}
            onclick={() => jumpTo(day)}
          >
            <span class="pill-weekday">{weekdayOf(day)}</span>
            <span class="pill-day">{day.day}</span>
          </button>
        {/each}
      </div>
      {#each monthDays.filter((day) => postsOnDay(day).length > 0) as day (dayKey(day))}
        <div class="agenda-day" id={dayKey(day)}>
          <h3 class:is-today={day.isToday}>{day.day} {MONTH_NAMES[day.month - 1]}</h3>
          {#each postsOnDay(day) as post (post.id)}
            <button type="button" class="agenda-post" onclick={() => openPost(post)}>
              {#if showsAll}{@render brandChip(post.brandId)}{/if}
              {#each platformsOf(post) as platform (platform)}
                <PlatformGlyph {platform} />
              {/each}
              <span class="chip-time">{timeOf(post)}</span>
              <span class="chip-caption">{post.caption}</span>
            </button>
          {/each}
        </div>
      {:else}
        <p class="empty-hint">Nothing scheduled this month.</p>
      {/each}
    </section>

    <aside class="unscheduled-list">
      <h2>Unscheduled</h2>
      {#if !unscheduledPosts.length}
        <p class="empty-hint">No drafts.</p>
      {:else}
        {#each unscheduledPosts as post (post.id)}
          <button type="button" class="unscheduled-item" onclick={() => openPost(post)}>
            {#if showsAll}{@render brandChip(post.brandId)}{/if}
            {#each platformsOf(post) as platform (platform)}
              <PlatformGlyph {platform} />
            {/each}
            <span class="chip-caption">{post.caption}</span>
          </button>
        {/each}
      {/if}
    </aside>
  </div>
</div>

{#if selectedPost}
  <div class="popover-backdrop" onclick={closePost} role="presentation">
    <div class="popover" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Post details">
      <header class="popover-header">
        <span class="popover-brand">
          {@render brandChip(selectedPost.brandId)}
          {brandsById.get(selectedPost.brandId)?.name}
        </span>
        <span class="status-badge">{selectedPost.status}</span>
        <Button variant="ghost" size="icon-sm" class="ml-auto" onclick={closePost} aria-label="Close"><X /></Button>
      </header>
      <p class="popover-caption">{selectedPost.caption}</p>
      {#if selectedPost.media.length}
        <p class="popover-media">{selectedPost.media.length} media item{selectedPost.media.length === 1 ? '' : 's'}</p>
      {/if}
      <ul class="popover-deliveries">
        {#each selectedPost.deliveries as delivery (delivery.accountId)}
          <li>
            <PlatformGlyph platform={delivery.platform} />
            <span>{delivery.status}</span>
            {#if delivery.url}<a href={delivery.url} target="_blank" rel="noreferrer">View</a>{/if}
            <form method="POST" action="?/reschedule" class="popover-action">
              <input type="hidden" name="postId" value={selectedPost.id} />
              <input type="hidden" name="accountId" value={delivery.accountId} />
              <input type="hidden" name="scheduledFor" value={isoOf(scheduleLocal)} />
              <Button variant="secondary" size="sm" type="submit">Move</Button>
            </form>
            <form method="POST" action="?/publishNow" class="popover-action">
              <input type="hidden" name="postId" value={selectedPost.id} />
              <input type="hidden" name="accountId" value={delivery.accountId} />
              <Button size="sm" type="submit">Publish now</Button>
            </form>
            <form method="POST" action="?/cancel" class="popover-action">
              <input type="hidden" name="postId" value={selectedPost.id} />
              <input type="hidden" name="accountId" value={delivery.accountId} />
              <Button variant="ghost" size="sm" type="submit">Cancel</Button>
            </form>
          </li>
        {/each}
      </ul>
      {#if deliveryErrors.length}
        <p class="popover-media" role="alert">{deliveryErrors.join(' · ')}</p>
      {/if}
      <label class="popover-when">
        When
        <input type="datetime-local" bind:value={scheduleLocal} />
      </label>
      {#if undeliveredOf(selectedPost).length}
        <form method="POST" action="?/schedule" class="popover-schedule">
          <input type="hidden" name="postId" value={selectedPost.id} />
          <input type="hidden" name="scheduledFor" value={isoOf(scheduleLocal)} />
          {#if needsAdultConfirmation}
            <label class="account-row" data-testid="confirm-uncensored">
              <input type="checkbox" name="confirmUncensored" value="true" required />
              This post contains adult content from an uncensored model. Publish it where the platform allows adult content.
            </label>
          {/if}
          {#each undeliveredOf(selectedPost) as account (account.id)}
            <label class="account-row">
              <input type="checkbox" name="accountId" value={account.id} checked />
              <PlatformGlyph platform={account.platform} />
              {account.handle ?? account.displayName ?? account.platform}
            </label>
          {/each}
          <Button type="submit">Schedule</Button>
        </form>
      {:else if !selectedPost.deliveries.length}
        <p class="popover-media">
          No account connected for this brand.
          <Button variant="link" href={`/p/${page.params.projectId}/settings/connected-accounts`}>Connect</Button>
        </p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .calendar-page {
    padding: 24px 32px;
  }

  .page-header {
    margin-bottom: 16px;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .title-row h1 {
    margin: 0;
    font-size: 20px;
  }

  .nav-buttons {
    display: flex;
    gap: 4px;
  }

  .title-row :global(.brand-select) {
    margin-left: auto;
  }

  .brand-chip {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 7px;
    font-weight: 700;
    color: #fff;
    object-fit: cover;
  }

  .popover-brand {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
  }

  .popover-when,
  .popover-schedule {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
  }

  .popover-when input {
    border: 1px solid var(--line, #ededef);
    background: transparent;
    padding: 4px 8px;
    font: inherit;
    color: var(--ink, #1d1d1f);
  }

  .account-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .calendar-body {
    display: flex;
    gap: 24px;
    align-items: flex-start;
    position: relative;
  }

  .calendar-body.has-overlay .grid-wrap,
  .calendar-body.has-overlay .unscheduled-list {
    filter: blur(2px);
    pointer-events: none;
  }

  .brand-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--paper-2, rgba(249, 249, 249, 0.9));
    z-index: 1;
  }

  .brand-overlay-box {
    border: 1px solid var(--line, #ededef);
    background: var(--paper, #fff);
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 320px;
    text-align: center;
  }

  .brand-overlay-title {
    margin: 0;
    font-weight: 600;
  }

  .brand-overlay-hint {
    margin: 0;
    font-size: 12px;
    color: var(--ink-faint, #9a9a9e);
  }

  .brand-create-link {
    border: 1px solid var(--line, #ededef);
    background: transparent;
    padding: 6px 10px;
    font: inherit;
    cursor: pointer;
    color: var(--ink, #1d1d1f);
  }

  .brand-create-link {
    display: block;
    text-decoration: none;
    text-align: center;
  }

  .grid-wrap {
    flex: 1;
    min-width: 0;
    border: 1px solid var(--line, #ededef);
  }

  .weekday-row,
  .week-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
  }

  .weekday-row {
    border-bottom: 1px solid var(--line, #ededef);
  }

  .weekday-cell {
    padding: 8px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-faint, #9a9a9e);
    text-align: center;
  }

  .day-cell {
    min-height: 96px;
    border-right: 1px solid var(--line, #ededef);
    border-bottom: 1px solid var(--line, #ededef);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .day-cell:nth-child(7n) {
    border-right: 0;
  }

  .day-cell.outside {
    color: var(--ink-faint, #9a9a9e);
    background: var(--paper-2, #f9f9f9);
  }

  .day-cell.is-today .day-number {
    font-weight: 700;
    color: var(--accent, #1d1d1f);
  }

  .day-number {
    font-size: 12px;
  }

  .day-chips {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .post-chip,
  .unscheduled-item {
    display: flex;
    align-items: center;
    gap: 4px;
    border: 1px solid var(--line, #ededef);
    background: var(--paper, #fff);
    padding: 2px 4px;
    font-size: 11px;
    text-align: left;
    cursor: pointer;
    width: 100%;
  }

  .chip-time {
    font-weight: 600;
    color: var(--ink-faint, #9a9a9e);
    flex: 0 0 auto;
  }

  .chip-caption {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .unscheduled-list {
    flex: 0 0 240px;
    border: 1px solid var(--line, #ededef);
    padding: 12px;
  }

  .unscheduled-list h2 {
    margin: 0 0 8px;
    font-size: 13px;
  }

  .unscheduled-item {
    margin-bottom: 4px;
  }

  .empty-hint {
    font-size: 12px;
    color: var(--ink-faint, #9a9a9e);
  }

  .popover-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }

  .popover {
    background: var(--paper, #fff);
    border: 1px solid var(--line, #ededef);
    padding: 16px;
    width: 320px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .popover-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status-badge {
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-faint, #9a9a9e);
  }

  .popover-caption {
    margin: 0;
    white-space: pre-wrap;
    font-size: 13px;
  }

  .popover-media {
    margin: 0;
    font-size: 11px;
    color: var(--ink-faint, #9a9a9e);
  }

  .popover-deliveries {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
  }

  .popover-deliveries li {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .popover-action {
    margin: 0 0 0 auto;
  }

  .agenda {
    display: none;
  }

  :global([data-viewport='mobile']) .calendar-page {
    padding: 12px 16px 24px;
  }
  :global([data-viewport='mobile']) .title-row {
    flex-wrap: wrap;
    gap: 8px;
  }
  :global([data-viewport='mobile']) .title-row h1 {
    flex: 1 0 100%;
  }
  :global([data-viewport='mobile']) .title-row :global([data-slot='button']),
  :global([data-viewport='mobile']) .title-row :global(select) {
    min-height: var(--touch-target);
    min-width: var(--touch-target);
  }
  :global([data-viewport='mobile']) .title-row :global(.brand-select) {
    flex: 1 1 auto;
  }
  :global([data-viewport='mobile']) .calendar-body {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  :global([data-viewport='mobile']) .grid-wrap {
    display: none;
  }
  :global([data-viewport='mobile']) .agenda {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }
  :global([data-viewport='mobile']) .unscheduled-list {
    flex: 0 0 auto;
  }
  .post-chip.is-draft {
    border-style: dashed;
    color: var(--ink-soft, #6e6e73);
  }

  :global([data-viewport='mobile']) .post-chip,
  :global([data-viewport='mobile']) .unscheduled-item {
    min-height: var(--touch-target);
    font-size: 13px;
  }

  .day-strip {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: none;
  }
  .day-pill {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: var(--touch-target);
    height: 52px;
    border: 1px solid var(--line, #ededef);
    background: var(--paper, #fff);
    font: inherit;
    color: var(--ink-faint, #9a9a9e);
  }
  .day-pill.has-posts {
    color: var(--ink, #1d1d1f);
    border-color: var(--ink, #1d1d1f);
    cursor: pointer;
  }
  .day-pill.is-today {
    color: var(--accent, #7c5cff);
  }
  .pill-weekday {
    font-size: 10px;
    text-transform: uppercase;
  }
  .pill-day {
    font-size: 15px;
    font-weight: 600;
  }
  .agenda-day {
    display: flex;
    flex-direction: column;
    gap: 4px;
    scroll-margin-top: 8px;
  }
  .agenda-day h3 {
    margin: 4px 0;
    font-size: 13px;
    font-weight: 600;
  }
  .agenda-day h3.is-today {
    color: var(--accent, #7c5cff);
  }
  .agenda-post {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: var(--touch-target);
    padding: 0 10px;
    border: 1px solid var(--line, #ededef);
    background: var(--paper, #fff);
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }

  :global([data-viewport='mobile']) .popover-backdrop {
    align-items: flex-end;
  }
  :global([data-viewport='mobile']) .popover {
    width: 100%;
    max-height: 85dvh;
    overflow-y: auto;
    padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
    border-width: 1px 0 0;
  }
  :global([data-viewport='mobile']) .popover-deliveries li {
    flex-wrap: wrap;
  }
  :global([data-viewport='mobile']) .popover-when input {
    min-height: var(--touch-target);
    min-width: var(--touch-target);
  }
</style>
