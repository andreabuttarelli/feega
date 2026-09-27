<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import PlatformGlyph from '$lib/components/PlatformGlyph.svelte';
  import { monthGrid, placePosts, type GridDay } from '$lib/calendar/month-grid';
  import type { CalendarPost } from './calendar-load';

  const CALENDAR_TIME_ZONE = 'Europe/Rome';

  const MONTH_NAMES = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  const WEEKDAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  let { data } = $props();

  const brand = $derived(data.brand);
  const posts = $derived(data.posts as CalendarPost[]);
  const year = $derived(data.month.year);
  const month = $derived(data.month.month);

  const today = new Date();
  const weeks = $derived(monthGrid(year, month, today));

  function scheduledForOf(post: CalendarPost): string | null {
    return post.deliveries.find((d) => d.scheduledFor)?.scheduledFor ?? null;
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
    return new Intl.DateTimeFormat('it-IT', { timeZone: CALENDAR_TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(at));
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
    void goto(`?month=${monthParam(y, m)}`, { keepFocus: true, noScroll: true });
  }

  function goToday() {
    void goto(`?month=${monthParam(today.getUTCFullYear(), today.getUTCMonth() + 1)}`, { keepFocus: true, noScroll: true });
  }

  let selectedPost = $state<CalendarPost | null>(null);

  function openPost(post: CalendarPost) {
    selectedPost = post;
  }

  function closePost() {
    selectedPost = null;
  }
</script>

<div class="calendar-page">
  <header class="page-header">
    <div class="title-row">
      <h1>{MONTH_NAMES[month - 1]} {year}</h1>
      <div class="nav-buttons">
        <button type="button" onclick={() => navigateMonth(-1)} aria-label="Mese precedente">‹</button>
        <button type="button" onclick={goToday}>Oggi</button>
        <button type="button" onclick={() => navigateMonth(1)} aria-label="Mese successivo">›</button>
      </div>
    </div>
    {#if brand}<p class="subtitle">{brand.name}</p>{/if}
  </header>

  <div class="calendar-body" class:has-overlay={!brand}>
    {#if !brand}
      <div class="brand-overlay">
        <div class="brand-overlay-box">
          <p class="brand-overlay-title">This project has no brand yet</p>
          <p class="brand-overlay-hint">Link an existing brand or create one to see the calendar.</p>

          {#if data.brands.length}
            <form method="POST" action="?/linkBrand" class="brand-link-form">
              <select name="brandId" required>
                <option value="" disabled selected>Choose a brand</option>
                {#each data.brands as b (b.id)}
                  <option value={b.id}>{b.name}</option>
                {/each}
              </select>
              <button type="submit">Link brand</button>
            </form>
          {/if}

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
                  <button type="button" class="post-chip" onclick={() => openPost(post)}>
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

    <aside class="unscheduled-list">
      <h2>Da programmare</h2>
      {#if !unscheduledPosts.length}
        <p class="empty-hint">Niente in bozza.</p>
      {:else}
        {#each unscheduledPosts as post (post.id)}
          <button type="button" class="unscheduled-item" onclick={() => openPost(post)}>
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
    <div class="popover" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Dettaglio post">
      <header class="popover-header">
        <span class="status-badge">{selectedPost.status}</span>
        <button type="button" class="close-btn" onclick={closePost} aria-label="Chiudi">×</button>
      </header>
      <p class="popover-caption">{selectedPost.caption}</p>
      {#if selectedPost.media.length}
        <p class="popover-media">{selectedPost.media.length} elemento{selectedPost.media.length === 1 ? '' : 'i'} media</p>
      {/if}
      <ul class="popover-deliveries">
        {#each selectedPost.deliveries as delivery (delivery.accountId)}
          <li>
            <PlatformGlyph platform={delivery.platform} />
            <span>{delivery.status}</span>
            {#if delivery.url}<a href={delivery.url} target="_blank" rel="noreferrer">Vedi</a>{/if}
            <form method="POST" action="?/publishNow" class="popover-action">
              <input type="hidden" name="postId" value={selectedPost.id} />
              <input type="hidden" name="accountId" value={delivery.accountId} />
              <button type="submit">Pubblica ora</button>
            </form>
            <form method="POST" action="?/cancel" class="popover-action">
              <input type="hidden" name="postId" value={selectedPost.id} />
              <input type="hidden" name="accountId" value={delivery.accountId} />
              <button type="submit">Annulla</button>
            </form>
          </li>
        {/each}
      </ul>
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

  .nav-buttons button {
    border: 1px solid var(--line, #ededef);
    background: transparent;
    padding: 4px 10px;
    font: inherit;
    cursor: pointer;
    color: var(--ink, #1d1d1f);
  }

  .subtitle {
    margin: 4px 0 0;
    color: var(--ink-faint, #9a9a9e);
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

  .brand-link-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .brand-link-form select,
  .brand-link-form button,
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

  .close-btn {
    border: 0;
    background: transparent;
    font-size: 16px;
    cursor: pointer;
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

  .popover-action button {
    border: 1px solid var(--line, #ededef);
    background: transparent;
    padding: 2px 8px;
    font-size: 11px;
    cursor: pointer;
    color: var(--ink, #1d1d1f);
  }
</style>
