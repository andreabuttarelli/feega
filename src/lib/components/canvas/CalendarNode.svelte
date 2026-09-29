<script lang="ts">
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import X from '@lucide/svelte/icons/x';
  import {
    CALENDAR_VIEWS,
    dayKeyOf,
    gridDayKey,
    periodGrid,
    periodTitle,
    placedInstant,
    shiftAnchor,
    CalendarView
  } from '$lib/calendar/period-grid';
  import { CALENDAR_SCOPES, CalendarScope, type CalendarNode } from '$lib/canvas/calendar-node';
  import type { CalendarPost, CalendarBrand } from '$lib/canvas/calendar-posts';

  const POST_DRAG_TYPE = 'application/x-feega-post';
  const LOCALE = 'en-US';
  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const VIEW_LABEL: Record<CalendarView, string> = { [CalendarView.Week]: 'Week', [CalendarView.Month]: 'Month' };
  const SCOPE_LABEL: Record<CalendarScope, string> = { [CalendarScope.Canvas]: 'This canvas', [CalendarScope.Brand]: 'Whole brand' };

  let {
    node,
    posts,
    brands,
    error = null,
    busy = false,
    timeZone,
    mediaUrl,
    onchange,
    onmove,
    onschedule,
    onedit,
    onrefresh
  }: {
    node: CalendarNode;
    posts: CalendarPost[] | null;
    brands: CalendarBrand[];
    error?: string | null;
    busy?: boolean;
    timeZone: string;
    mediaUrl: (assetId: string) => string | null;
    onchange: (patch: Partial<CalendarNode>) => void;
    onmove: (post: CalendarPost, dayKey: string) => void;
    onschedule: (post: CalendarPost) => void;
    onedit: (post: CalendarPost) => void;
    onrefresh: () => void;
  } = $props();

  let openId = $state<string | null>(null);
  let dropKey = $state<string | null>(null);

  const weeks = $derived(periodGrid(node.view, node.anchor, new Date()));
  const opened = $derived(posts?.find((p) => p.id === openId) ?? null);

  const postsByDay = $derived.by(() => {
    const byDay = new Map<string, CalendarPost[]>();
    for (const post of posts ?? []) {
      const at = placedInstant(post);
      if (!at) {
        continue;
      }
      const key = dayKeyOf(at, timeZone);
      byDay.set(key, [...(byDay.get(key) ?? []), post]);
    }
    return byDay;
  });

  const unplanned = $derived((posts ?? []).filter((p) => !placedInstant(p)));

  function timeOf(post: CalendarPost): string {
    const at = placedInstant(post);
    return at ? new Intl.DateTimeFormat(LOCALE, { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(at)) : '';
  }

  function dragPost(event: DragEvent, post: CalendarPost) {
    event.dataTransfer?.setData(POST_DRAG_TYPE, post.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  function overDay(event: DragEvent, key: string) {
    if (!event.dataTransfer?.types.includes(POST_DRAG_TYPE)) {
      return;
    }
    event.preventDefault();
    dropKey = key;
  }

  function dropOnDay(event: DragEvent, key: string) {
    const postId = event.dataTransfer?.getData(POST_DRAG_TYPE);
    dropKey = null;
    const post = posts?.find((p) => p.id === postId);
    if (!post || post.scheduled) {
      return;
    }
    event.preventDefault();
    onmove(post, key);
  }
</script>

<div class="cal" data-calendar-node={node.id}>
  <header class="cal-head nodrag">
    <button type="button" class="cal-nav" aria-label="Previous" onclick={() => onchange({ anchor: shiftAnchor(node.view, node.anchor, -1) })}>
      <ChevronLeft size={14} strokeWidth={2} />
    </button>
    <strong class="cal-title">{periodTitle(node.view, node.anchor)}</strong>
    <button type="button" class="cal-nav" aria-label="Next" onclick={() => onchange({ anchor: shiftAnchor(node.view, node.anchor, 1) })}>
      <ChevronRight size={14} strokeWidth={2} />
    </button>

    <div class="cal-seg" role="group" aria-label="View">
      {#each CALENDAR_VIEWS as view (view)}
        <button type="button" class:is-active={node.view === view} onclick={() => onchange({ view })}>{VIEW_LABEL[view]}</button>
      {/each}
    </div>

    <div class="cal-seg" role="group" aria-label="Scope">
      {#each CALENDAR_SCOPES as scope (scope)}
        <button type="button" class:is-active={node.scope === scope} onclick={() => onchange({ scope })}>{SCOPE_LABEL[scope]}</button>
      {/each}
    </div>

    <select
      class="cal-brand"
      aria-label="Brand"
      value={node.brandId ?? ''}
      onchange={(e) => onchange({ brandId: e.currentTarget.value || null })}
    >
      <option value="">Pick a brand…</option>
      {#each brands as brand (brand.id)}
        <option value={brand.id}>{brand.name}</option>
      {/each}
    </select>

    <button type="button" class="cal-nav" aria-label="Refresh" onclick={onrefresh} disabled={busy}>
      <RefreshCw size={13} strokeWidth={2} />
    </button>
  </header>

  {#if error}
    <p class="cal-error" role="alert">{error}</p>
  {/if}

  <div class="cal-weekdays">
    {#each WEEKDAYS as weekday (weekday)}
      <span>{weekday}</span>
    {/each}
  </div>

  <div class="cal-grid nowheel" class:is-week={node.view === CalendarView.Week}>
    {#each weeks as week, wi (wi)}
      {#each week as day (gridDayKey(day))}
        {@const key = gridDayKey(day)}
        <div
          class="cal-day"
          class:outside={day.outside}
          class:is-today={day.isToday}
          class:is-drop={dropKey === key}
          data-calendar-day={key}
          role="listitem"
          ondragover={(e) => overDay(e, key)}
          ondragleave={() => (dropKey = dropKey === key ? null : dropKey)}
          ondrop={(e) => dropOnDay(e, key)}
        >
          <span class="cal-num">{day.day}</span>
          {#each postsByDay.get(key) ?? [] as post (post.id)}
            <button
              type="button"
              class="cal-chip nodrag"
              class:is-draft={!post.scheduled}
              draggable={!post.scheduled}
              data-post-id={post.id}
              ondragstart={(e) => dragPost(e, post)}
              onclick={() => (openId = post.id)}
            >
              <span class="cal-time">{timeOf(post)}</span>
              <span class="cal-caption">{post.caption || 'Untitled draft'}</span>
            </button>
          {/each}
        </div>
      {/each}
    {/each}
  </div>

  {#if unplanned.length}
    <footer class="cal-unplanned nodrag">
      <span>Unplanned</span>
      {#each unplanned as post (post.id)}
        <button type="button" class="cal-chip is-draft" draggable="true" ondragstart={(e) => dragPost(e, post)} onclick={() => (openId = post.id)}>
          <span class="cal-caption">{post.caption || 'Untitled draft'}</span>
        </button>
      {/each}
    </footer>
  {/if}

  {#if posts === null}
    <p class="cal-empty">Loading…</p>
  {/if}

  {#if opened}
    <div class="cal-pop nodrag nowheel" role="dialog" aria-label="Post">
      <header>
        <strong>{opened.scheduled ? 'Scheduled' : 'Draft'}</strong>
        <span>{timeOf(opened)} {placedInstant(opened) ? dayKeyOf(placedInstant(opened)!, timeZone) : 'not planned'}</span>
        <button type="button" class="cal-nav" aria-label="Close" onclick={() => (openId = null)}><X size={13} strokeWidth={2} /></button>
      </header>
      {#if opened.media.length}
        <div class="cal-media">
          {#each opened.media as m (m.assetId)}
            {@const url = mediaUrl(m.assetId)}
            {#if url}<img src={url} alt="" loading="lazy" />{/if}
          {/each}
        </div>
      {/if}
      <p class="cal-text">{opened.caption || 'No caption yet.'}</p>
      {#each opened.deliveries as delivery (delivery.accountId)}
        <p class="cal-delivery">{delivery.platform} · {delivery.status}{delivery.error ? ` · ${delivery.error}` : ''}</p>
      {/each}
      {#if !opened.scheduled}
        <footer>
          <button type="button" class="cal-btn" onclick={() => onedit(opened)}>Edit</button>
          <button type="button" class="cal-btn is-primary" disabled={busy || !opened.plannedFor} onclick={() => onschedule(opened)}>Schedule</button>
        </footer>
      {/if}
    </div>
  {/if}
</div>

<style>
  .cal {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--paper, #fff);
    border: 1px solid var(--line, #e5e5e5);
    box-shadow:
      0 1px 2px rgb(0 0 0 / 0.05),
      0 8px 24px -12px rgb(0 0 0 / 0.2);
    overflow: hidden;
    font-size: 12px;
  }

  .cal-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--line, #e5e5e5);
  }

  .cal-title {
    min-width: 150px;
    text-align: center;
    color: var(--ink, #1d1d1f);
  }

  .cal-nav {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    color: var(--ink-soft, #6e6e73);
    background: none;
    border: 1px solid var(--line-2, #d2d2d7);
    cursor: pointer;
  }
  .cal-nav:disabled {
    opacity: 0.4;
  }

  .cal-seg {
    display: inline-flex;
    border: 1px solid var(--line-2, #d2d2d7);
  }
  .cal-seg button {
    padding: 2px 8px;
    font: inherit;
    color: var(--ink-soft, #6e6e73);
    background: none;
    border: none;
    cursor: pointer;
  }
  .cal-seg button.is-active {
    color: var(--paper, #fff);
    background: var(--ink, #1d1d1f);
  }

  .cal-brand {
    font: inherit;
    padding: 2px 4px;
    border: 1px solid var(--line-2, #d2d2d7);
    background: var(--paper, #fff);
    color: var(--ink, #1d1d1f);
  }

  .cal-error {
    margin: 0;
    padding: 6px 8px;
    color: var(--danger, #b42318);
    background: var(--danger-soft, #fef3f2);
    border-bottom: 1px solid var(--line, #e5e5e5);
  }

  .cal-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border-bottom: 1px solid var(--line, #e5e5e5);
    color: var(--ink-soft, #6e6e73);
    font-size: 11px;
  }
  .cal-weekdays span {
    padding: 3px 6px;
  }

  .cal-grid {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-auto-rows: minmax(0, 1fr);
    overflow: auto;
  }

  .cal-day {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    min-height: 0;
    padding: 4px;
    border-right: 1px solid var(--line, #e5e5e5);
    border-bottom: 1px solid var(--line, #e5e5e5);
    overflow: hidden;
  }
  .cal-day.outside {
    background: var(--paper-2, #f9f9f9);
    color: var(--ink-soft, #6e6e73);
  }
  .cal-day.is-drop,
  :global(.cal-day.is-node-drop) {
    outline: 2px solid var(--accent, #1d1d1f);
    outline-offset: -2px;
  }
  .cal-day.is-today .cal-num {
    color: var(--paper, #fff);
    background: var(--ink, #1d1d1f);
  }

  .cal-num {
    align-self: flex-start;
    padding: 0 4px;
    font-size: 11px;
  }

  .cal-chip {
    display: flex;
    gap: 4px;
    width: 100%;
    padding: 2px 4px;
    font: inherit;
    font-size: 11px;
    text-align: left;
    color: var(--ink, #1d1d1f);
    background: var(--paper-2, #f4f4f5);
    border: 1px solid var(--line-2, #d2d2d7);
    cursor: pointer;
  }
  .cal-chip.is-draft {
    border-style: dashed;
    background: var(--paper, #fff);
    cursor: grab;
  }
  .cal-time {
    flex: none;
    color: var(--ink-soft, #6e6e73);
  }
  .cal-caption {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .cal-unplanned {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 6px 8px;
    border-top: 1px solid var(--line, #e5e5e5);
    overflow-x: auto;
  }
  .cal-unplanned .cal-chip {
    width: auto;
    max-width: 160px;
  }

  .cal-empty {
    position: absolute;
    inset: auto 0 8px;
    margin: 0;
    text-align: center;
    color: var(--ink-soft, #6e6e73);
  }

  .cal-pop {
    position: absolute;
    top: 44px;
    right: 8px;
    width: min(300px, calc(100% - 16px));
    max-height: calc(100% - 56px);
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    overflow: auto;
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    box-shadow: 0 12px 32px -14px rgb(0 0 0 / 0.3);
  }
  .cal-pop header,
  .cal-pop footer {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .cal-pop header span {
    flex: 1;
    color: var(--ink-soft, #6e6e73);
  }
  .cal-pop footer {
    justify-content: flex-end;
  }

  .cal-media {
    display: flex;
    gap: 4px;
    overflow-x: auto;
  }
  .cal-media img {
    width: 72px;
    height: 72px;
    object-fit: cover;
  }

  .cal-text {
    margin: 0;
    white-space: pre-wrap;
  }

  .cal-delivery {
    margin: 0;
    color: var(--ink-soft, #6e6e73);
  }

  .cal-btn {
    padding: 4px 10px;
    font: inherit;
    color: var(--ink, #1d1d1f);
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    cursor: pointer;
  }
  .cal-btn.is-primary {
    color: var(--paper, #fff);
    background: var(--ink, #1d1d1f);
    border-color: var(--ink, #1d1d1f);
  }
  .cal-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
