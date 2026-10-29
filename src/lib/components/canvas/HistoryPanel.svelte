<script lang="ts">
  import UserRound from '@lucide/svelte/icons/user-round';
  import MessageSquare from '@lucide/svelte/icons/message-square';
  import Bot from '@lucide/svelte/icons/bot';
  import Cog from '@lucide/svelte/icons/cog';
  import Frame from '@lucide/svelte/icons/frame';
  import Eye from '@lucide/svelte/icons/eye';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Tag from '@lucide/svelte/icons/tag';
  import BookmarkPlus from '@lucide/svelte/icons/bookmark-plus';
  import GitMerge from '@lucide/svelte/icons/git-merge';
  import GitBranch from '@lucide/svelte/icons/git-branch';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { Side } from '$lib/motion/branch-merge';
  import { untrack, type Component } from 'svelte';
  import { SegmentedControl } from '$lib/components/ui/shell';
  import { canvasSelection } from '$lib/canvas/canvas-selection';
  import { historyPanel } from '$lib/canvas/history-panel.svelte';
  import { postPageAction } from '$lib/api/page-action';
  import { LocalOff, isOff } from '$lib/local-user';
  import { ENTRY_VERBS, EntryKind, HistoryAction, HistoryFilter, LaneIcon, actionsOf, branchForks, laneSpans, type HistoryEntry, type HistoryGraph } from '$lib/canvas/history/timeline';
  import type { HistoryPreview } from '$lib/server/canvas/history-actions';
  import { liveRefresh, mergeGraph } from '$lib/canvas/history/live';
  import { watchHistory } from '$lib/realtime/history-channel';
  import { createSupabaseBrowserClient } from '$lib/supabase/client';

  let { projectId, canvasId }: { projectId: string; canvasId: string } = $props();

  const ICON = 12;
  const LANE_PX = 12;
  const ROW_PX = 28;
  const DOT_R = 3.5;

  const LANE_ICONS: Record<LaneIcon, Component<{ size?: number }>> = {
    [LaneIcon.Person]: UserRound,
    [LaneIcon.Chat]: MessageSquare,
    [LaneIcon.Agent]: Bot,
    [LaneIcon.System]: Cog
  };

  const FILTERS = [
    { value: HistoryFilter.All, label: 'All' },
    { value: HistoryFilter.Ai, label: 'AI' },
    { value: HistoryFilter.People, label: 'People' }
  ];

  const ACTION_UI: Record<HistoryAction, { label: string; icon: Component<{ size?: number }> }> = {
    [HistoryAction.Preview]: { label: 'Preview', icon: Eye },
    [HistoryAction.Restore]: { label: 'Restore to here', icon: RotateCcw },
    [HistoryAction.Name]: { label: 'Name this version', icon: Tag },
    [HistoryAction.Merge]: { label: 'Merge', icon: GitMerge },
    [HistoryAction.Drop]: { label: 'Drop', icon: Trash2 }
  };

  const KEEPS = [
    { side: Side.Branch, label: 'Keep branch' },
    { side: Side.Main, label: 'Keep main' }
  ];

  const ACTION_FAILED = 'That could not be done: reload and try again.';

  let filter = $state(HistoryFilter.All);
  let oneFrame = $state(historyPanel.frameId !== null);
  let graph = $state<HistoryGraph | null>(null);
  let failed = $state(false);
  let reads = $state(0);
  let opened = $state<string | null>(null);
  let preview = $state<HistoryPreview | null>(null);
  let naming = $state<string | null>(null);
  let saving = $state(false);
  let notice = $state('');
  let conflicts = $state<string[] | null>(null);
  let branching = $state(false);

  let resolving = $state<string | null>(null);

  const CONFLICT_PREFIX = 'conflict:';
  const SIDES = [
    { keep: 'mine', label: 'Keep mine' },
    { keep: 'theirs', label: 'Keep theirs' }
  ];

  const frameId = $derived(oneFrame ? ($canvasSelection[0] ?? null) : null);
  const spans = $derived(graph ? laneSpans(graph) : []);
  const forks = $derived(graph ? branchForks(graph) : []);
  const gutter = $derived(Math.max(1, graph?.lanes.length ?? 1) * LANE_PX);

  $effect(() => {
    if (historyPanel.asked) {
      oneFrame = historyPanel.frameId !== null;
    }
  });

  $effect(() => {
    void reads;
    const params = new URLSearchParams({ author: filter, ...(frameId ? { frame: frameId } : {}) });
    const controller = new AbortController();
    failed = false;
    fetch(`/p/${projectId}/c/${canvasId}/history?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((read: HistoryGraph) => (graph = mergeGraph(untrack(() => graph), read)))
      .catch((e: Error) => {
        if (e.name !== 'AbortError') {
          failed = true;
        }
      });
    return () => controller.abort();
  });

  $effect(() => {
    const live = liveRefresh(() => {
      if (document.visibilityState === 'visible') {
        reads += 1;
      }
    });
    const unwatch = watchHistory(createSupabaseBrowserClient(), canvasId, live.changed, live.feed);
    const focused = () => {
      if (document.visibilityState === 'visible') {
        live.focused();
      }
    };
    window.addEventListener('focus', focused);
    document.addEventListener('visibilitychange', focused);
    return () => {
      live.stop();
      unwatch();
      window.removeEventListener('focus', focused);
      document.removeEventListener('visibilitychange', focused);
    };
  });

  const pointUrl = (entry: HistoryEntry) => `/p/${projectId}/c/${canvasId}/history/${encodeURIComponent(entry.id)}`;

  function toggle(entry: HistoryEntry) {
    opened = opened === entry.id ? null : entry.id;
    preview = null;
    naming = null;
    conflicts = null;
    notice = '';
  }

  async function write(entry: HistoryEntry, body: Record<string, string>) {
    const res = await fetch(pointUrl(entry), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const read = (await res.json().catch(() => ({}))) as { conflicts?: string[] };
    conflicts = read.conflicts ?? null;
    notice = res.ok || conflicts ? '' : ACTION_FAILED;
    reads += 1;
  }

  const RUN: Record<HistoryAction, (entry: HistoryEntry) => Promise<void> | void> = {
    [HistoryAction.Preview]: async (entry) => {
      const res = await fetch(pointUrl(entry));
      const read = res.ok ? ((await res.json()) as { preview: HistoryPreview }) : null;
      preview = read?.preview ?? null;
      notice = read ? '' : ACTION_FAILED;
    },
    [HistoryAction.Restore]: (entry) => write(entry, { action: HistoryAction.Restore }),
    [HistoryAction.Name]: (entry) => {
      naming = entry.summary ?? '';
    },
    [HistoryAction.Merge]: (entry) => write(entry, { action: HistoryAction.Merge }),
    [HistoryAction.Drop]: (entry) => write(entry, { action: HistoryAction.Drop })
  };

  async function branchFrame(name: string) {
    const form = new FormData();
    form.set('name', name);
    const result = await postPageAction(`/p/${projectId}/c/${canvasId}/motion/${frameId}`, 'createBranch', form);
    notice = result.type === 'success' ? '' : ACTION_FAILED;
    branching = false;
    reads += 1;
  }

  async function saveVersion(name: string) {
    const form = new FormData();
    form.set('name', name);
    const result = await postPageAction(`/p/${projectId}/c/${canvasId}`, 'saveCanvasVersion', form);
    notice = result.type === 'success' ? '' : ACTION_FAILED;
    saving = false;
    reads += 1;
  }

  const isFrame = (p: HistoryPreview): p is Extract<HistoryPreview, { frameId: string }> => 'frameId' in p;

  async function resolve(entryId: string, keep: string) {
    resolving = entryId;
    const conflictId = entryId.slice(CONFLICT_PREFIX.length);
    await fetch(`/p/${projectId}/c/${canvasId}/history`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conflictId, keep }) }).catch(() => null);
    resolving = null;
    reads += 1;
  }

  const timeOf = (at: string) => new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const laneX = (lane: number) => lane * LANE_PX + LANE_PX / 2;
</script>

<div class="history" data-testid="history-panel">
  <div class="filters">
    <SegmentedControl label="Who" options={FILTERS} value={filter} onchange={(v) => (filter = v as HistoryFilter)} class="flex-1" />
    <button type="button" class="frame-toggle" class:on={oneFrame} aria-pressed={oneFrame} aria-label="One frame" title="Only the selected frame" disabled={!$canvasSelection.length && !oneFrame} onclick={() => (oneFrame = !oneFrame)} data-testid="history-one-frame">
      <Frame size={14} />
    </button>
    {#if oneFrame && frameId}
      <button type="button" class="frame-toggle" aria-label="New branch" title="Branch the selected frame" onclick={() => (branching = !branching)} data-testid="history-new-branch">
        <GitBranch size={14} />
      </button>
    {/if}
    {#if !isOff(LocalOff.Versions)}
      <button type="button" class="frame-toggle" aria-label="Save version" title="Save the canvas as a version" onclick={() => (saving = !saving)} data-testid="history-save-version">
        <BookmarkPlus size={14} />
      </button>
    {/if}
  </div>

  {#if saving}
    <input class="name-input" aria-label="Version name" placeholder="Name this version" data-testid="history-version-name" onkeydown={(e) => e.key === 'Enter' && void saveVersion(e.currentTarget.value)} />
  {/if}

  {#if branching}
    <input class="name-input" aria-label="Branch name" placeholder="Name the branch" data-testid="history-branch-name" onkeydown={(e) => e.key === 'Enter' && void branchFrame(e.currentTarget.value)} />
  {/if}

  {#if notice}
    <p class="empty" role="status">{notice}</p>
  {/if}

  {#if graph && graph.lanes.length}
    <div class="lanes" data-testid="history-lanes">
      {#each graph.lanes as lane (lane.key)}
        {@const Icon = LANE_ICONS[lane.icon]}
        <span class="lane" style:--lane={lane.colour} title={lane.label}><Icon size={ICON} /><span class="lane-name">{lane.label}</span></span>
      {/each}
    </div>
  {/if}

  {#if failed}
    <p class="empty">History could not be read.</p>
  {:else if graph && !graph.rows.length}
    <p class="empty">Nothing changed here yet.</p>
  {:else if graph}
    <ol class="rows">
      {#each graph.rows as row, index (row.entry.id)}
        {@const lane = graph.lanes[row.lane]}
        {@const Icon = LANE_ICONS[lane.icon]}
        {@const open = row.entry.kind === EntryKind.ConflictOpen}
        {@const actions = actionsOf(row.entry)}
        <li class="row" class:conflict={open} class:open={opened === row.entry.id} data-testid="history-row" data-lane={lane.kind} onclick={() => actions.length && toggle(row.entry)} onkeydown={(e) => e.key === 'Enter' && actions.length && toggle(row.entry)} role={actions.length ? 'button' : undefined} tabindex={actions.length ? 0 : undefined}>
          <svg class="graph" width={gutter} height={ROW_PX} aria-hidden="true">
            {#each spans as span, l (l)}
              {#if index >= span.first && index <= span.last}
                <line x1={laneX(l)} x2={laneX(l)} y1={index === span.first ? ROW_PX / 2 : 0} y2={index === span.last ? ROW_PX / 2 : ROW_PX} stroke={graph.lanes[l].colour} stroke-opacity="0.45" stroke-width="1.5" />
              {/if}
            {/each}
            {#each forks.filter((f) => f.from === index) as fork (fork.to)}
              <path d={`M ${laneX(row.lane)} ${ROW_PX / 2} Q ${laneX(fork.lane)} ${ROW_PX / 2} ${laneX(fork.lane)} ${ROW_PX}`} fill="none" stroke={lane.colour} stroke-width="1.5" stroke-dasharray="3 2" data-testid="history-fork" />
            {/each}
            <circle cx={laneX(row.lane)} cy={ROW_PX / 2} r={DOT_R} fill={lane.colour} />
          </svg>
          <span class="who" style:color={lane.colour} title={lane.label}><Icon size={ICON} /></span>
          <span class="what">{ENTRY_VERBS[row.entry.kind]}{#if row.entry.summary}<span class="summary"> · {row.entry.summary}</span>{/if}</span>
          {#if open}
            <span class="sides">
              {#each SIDES as side (side.keep)}
                <button type="button" class="side" disabled={resolving === row.entry.id} onclick={(e) => { e.stopPropagation(); void resolve(row.entry.id, side.keep); }} data-testid="history-keep-{side.keep}">{side.label}</button>
              {/each}
            </span>
          {:else}
            <time class="when" datetime={row.entry.at}>{timeOf(row.entry.at)}</time>
          {/if}
        </li>
        {#if opened === row.entry.id}
          <li class="point" data-testid="history-point">
            <div class="point-actions">
              {#each actions as action (action)}
                {@const ui = ACTION_UI[action]}
                <button type="button" class="point-action" onclick={() => void RUN[action](row.entry)} data-testid={`history-action-${action}`}><ui.icon size={ICON} />{ui.label}</button>
              {/each}
            </div>
            {#if naming !== null}
              <input class="name-input" aria-label="Version name" placeholder="Name this version" value={naming} data-testid="history-name-input" onkeydown={(e) => e.key === 'Enter' && void write(row.entry, { action: HistoryAction.Name, name: e.currentTarget.value }).then(() => (naming = null))} />
            {/if}
            {#if conflicts}
              <div class="preview" data-testid="history-conflicts">
                <span>{conflicts.length} conflicts with the frame</span>
                <div class="point-actions">
                  {#each KEEPS as keep (keep.side)}
                    <button type="button" class="point-action" onclick={() => void write(row.entry, { action: HistoryAction.Merge, keep: keep.side })}>{keep.label}</button>
                  {/each}
                </div>
              </div>
            {/if}
            {#if preview}
              <div class="preview" data-testid="history-preview">
                {#if isFrame(preview)}
                  <span>Frame at version {preview.version}{preview.summary ? ` · ${preview.summary}` : ''}</span>
                  <span class="summary">{preview.clips} clips · {preview.seconds.toFixed(1)} s</span>
                {:else}
                  <span>{preview.name}</span>
                  <span class="summary">{preview.nodes.length} nodes · {preview.connections} connections</span>
                  <ul class="preview-nodes">
                    {#each preview.nodes as n (n.id)}
                      <li>{n.type}</li>
                    {/each}
                  </ul>
                {/if}
              </div>
            {/if}
          </li>
        {/if}
      {/each}
    </ol>
  {/if}
</div>

<style>
  .history {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
  }

  .filters {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .frame-toggle {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-secondary);
  }

  .frame-toggle:hover:not(:disabled),
  .frame-toggle.on {
    background: var(--ui-hover);
    color: var(--ui-text);
  }

  .frame-toggle:disabled {
    opacity: 0.4;
  }

  .lanes {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 0 2px;
  }

  .lane {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    height: 20px;
    padding: 0 6px;
    border-radius: var(--ui-radius-full);
    background: color-mix(in srgb, var(--lane) 14%, transparent);
    color: var(--lane);
    font-size: 11px;
  }

  .lane-name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .rows {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    height: var(--ui-row-sm);
    padding-right: 4px;
    border-radius: var(--ui-radius-sm);
    color: var(--ui-text);
  }

  .row:hover,
  .row.open {
    background: var(--ui-hover);
  }

  .row[role='button'] {
    cursor: pointer;
  }

  .point {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 4px 8px;
  }

  .point-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .point-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 6px;
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text);
    font-size: 11px;
  }

  .point-action:hover {
    background: var(--ui-hover);
  }

  .name-input {
    height: 24px;
    padding: 0 6px;
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: inherit;
    font: inherit;
  }

  .preview {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-wash);
  }

  .preview-nodes {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
    color: var(--ui-text-secondary);
    font-size: 11px;
  }

  .row.conflict {
    background: color-mix(in srgb, var(--ui-danger) 10%, transparent);
    color: var(--ui-danger);
  }

  .sides {
    display: flex;
    flex: 0 0 auto;
    gap: 2px;
  }

  .side {
    height: 20px;
    padding: 0 6px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: inherit;
    font-size: 11px;
  }

  .side:hover:not(:disabled) {
    background: color-mix(in srgb, currentColor 14%, transparent);
  }

  .side:disabled {
    opacity: 0.4;
  }

  .graph {
    flex: 0 0 auto;
  }

  .who {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
  }

  .what {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .summary {
    color: var(--ui-text-secondary);
  }

  .when {
    flex: 0 0 auto;
    color: var(--ui-text-tertiary);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .empty {
    margin: 8px 6px;
    color: var(--ui-text-secondary);
  }
</style>
