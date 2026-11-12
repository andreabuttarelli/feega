<script lang="ts">
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import { codeMapOf, importInto, repoHead, repoPull, type CodeMapRead, type RepoHead } from '$lib/canvas/code-import-client';
  import { BASE_COND, condKey, condLabel, condOf, isPattern, MapPhase, mapRows, PageAction, Shown, Tone, type Cond, type MapRow } from '$lib/canvas/import-map';
  import { landImport, LandOutcome } from '$lib/canvas/import-into';
  import { routeMatches } from '$lib/canvas/route-pattern';
  import { zoomRequest } from '$lib/canvas/view-menu.svelte';
  import { Command } from '$lib/motion/shortcuts';
  import type { FrameEditSession } from '$lib/motion/frame-edit-session.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Fold, Section } from '$lib/components/ui/shell';
  import { tick } from 'svelte';
  import { editorMode, EditorMode } from '$lib/canvas/editor-mode.svelte';
  import { importRuns } from '$lib/canvas/import-runs.svelte';
  import { frameProperties } from './frame-properties.svelte';
  import { Region } from '$lib/canvas/key-region.svelte';

  let { projectId, canvasId, nodeId, session, doc }: { projectId: string; canvasId: string; nodeId: string; session: FrameEditSession; doc: MotionDoc } = $props();

  const NOT_FROM_CODE = 'not_from_code';
  const PAGE_HEIGHT = 800;
  const IMPORTING = 'Importing…';
  const SEARCH_FROM = 8;
  const RELOAD_MS = 800;
  const SIZE_SLACK = 1;
  const FAILED: Record<string, string> = {
    frame_full: 'This frame is full: 20 pages, the most Pull refreshes in one run. Import into a new frame.',
    no_room: 'No room left in this frame: a frame is at most 16384 px a side. Import into a new frame.',
    rate_limited: 'Two imports every ten minutes. Try again shortly.',
    sign_in_needed: 'The page went to a sign-in page. Add a TEST account in project settings.',
    run_failed: 'The app could not be started.',
    unavailable: 'The import did not answer. Try again.'
  };
  const FALLBACK = 'Could not import that page.';
  const KIND_TITLE: Record<CodeMapRead['kind'], string> = { github: 'GitHub', folder: 'Folder', upload: 'Uploaded folder' };

  let read = $state<CodeMapRead | null>(null);
  let phase = $state<MapPhase>(MapPhase.Loading);
  let head = $state<RepoHead | null>(null);
  let query = $state('');
  let values = $state<Record<string, string>>({});
  let editing = $state<string | null>(null);
  let pulling = $state(false);
  let pullNote = $state<string | null>(null);

  const present = $derived(new Set([...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips.map((c) => c.id))));
  const rows = $derived(read?.map ? mapRows(read.map, (id) => present.has(id)) : []);
  const shown = $derived(query ? rows.filter((r) => r.path.toLowerCase().includes(query.toLowerCase())) : rows);
  const used = $derived(rows.reduce((n, r) => n + r.boards.length, 0));
  const room = $derived((read?.limit ?? 0) - used);

  async function load() {
    const got = await codeMapOf(projectId, nodeId);
    if (!got.ok) {
      phase = got.error === NOT_FROM_CODE ? MapPhase.None : MapPhase.Error;
      return;
    }
    read = got.value;
    phase = MapPhase.Ready;
    const at = await repoHead(projectId, nodeId);
    head = at.ok ? at.value : null;
  }

  $effect(() => {
    void nodeId;
    const later = setTimeout(() => void load(), RELOAD_MS);
    return () => clearTimeout(later);
  });

  $effect(() => {
    const place = frameProperties.place;
    if (!place || !doc.width || phase !== MapPhase.Ready) {
      return;
    }
    const height = (doc.height * place.w) / doc.width;
    if (Math.abs(height - place.h) > SIZE_SLACK) {
      place.grow(place.w, height);
    }
  });

  function zoomTo(row: MapRow) {
    session.select(row.boards.map((b) => b.clip));
    zoomRequest.ask(Command.PreviewSelection);
  }

  async function importPage(path: string, conds: Cond[], key: string) {
    if (!importRuns.start(nodeId, key, IMPORTING)) {
      return;
    }
    if (editorMode.current === EditorMode.Code) {
      editorMode.set(EditorMode.Design);
      await tick();
    }
    const conditions = conds.map((c) => ({ scheme: c.scheme, width: c.width }));
    const label = conds.length === 1 && condKey(conds[0]) !== condKey(BASE_COND) ? `${path} · ${condLabel(conds[0])}` : path;
    const done = await landImport(session, {
      label,
      map: read?.map ?? null,
      size: { width: conds[0]?.width ?? BASE_COND.width, height: PAGE_HEIGHT },
      newId: () => crypto.randomUUID().slice(0, 8),
      resized: (from, to) => frameProperties.place?.grow((frameProperties.place.w * to.width) / from.width, (frameProperties.place.h * to.height) / from.height),
      fetch: async () => {
        const got = await importInto({ projectId, canvasId, nodeId, routes: [path], conditions });
        return got.ok ? { ok: true, piece: got.value.piece, boards: got.value.boards, parent: got.value.parent } : { ok: false, error: got.error, ...(got.detail ? { detail: got.detail } : {}) };
      }
    });
    importRuns.finish(nodeId, key, done.outcome === LandOutcome.Landed ? `Imported ${label}.` : (FAILED[done.error] ?? `${FALLBACK}${done.detail ? ` ${done.detail}` : ''}`));
    await load();
  }

  function act(row: MapRow) {
    const take: Record<PageAction, () => void> = {
      [PageAction.Zoom]: () => zoomTo(row),
      [PageAction.Import]: () => void importPage(row.path, [BASE_COND], row.path),
      [PageAction.Retry]: () => void importPage(row.path, [BASE_COND], row.path),
      [PageAction.SetValue]: () => (editing = editing === row.path ? null : row.path),
      [PageAction.SignIn]: () => window.open(`/p/${projectId}/settings/project#app-account`, '_blank', 'noopener')
    };
    take[row.rule.action]();
  }

  function importValue(row: MapRow) {
    const path = (values[row.path] ?? '').trim();
    if (!path || isPattern(path) || !routeMatches(row.path, path)) {
      importRuns.note(nodeId, row.path, `Type a path that fits ${row.path}, e.g. ${row.values[0] ?? row.path.replace(/\[[^\]]+\]/g, 'value')}.`);
      return;
    }
    editing = null;
    void importPage(path, [BASE_COND], row.path);
  }

  function addCondition(row: MapRow, key: string) {
    if (key) {
      void importPage(row.path, [condOf(key)], `${row.path}@${key}`);
    }
  }

  async function pull() {
    pulling = true;
    pullNote = null;
    const done = await repoPull(projectId, nodeId, '');
    pulling = false;
    pullNote = done.ok ? (done.value.outcome === 'up_to_date' ? `Already at ${done.value.sha.slice(0, 7)}.` : `Pulled ${done.value.sha.slice(0, 7)}.`) : 'Could not pull.';
    await load();
  }

  const busyIn = (row: MapRow) => importRuns.runningFor(nodeId, row.path);
  const noteIn = (row: MapRow) => importRuns.noteFor(nodeId, row.path);
  const upToDate = $derived(head && head.head ? head.head === head.sha : null);
</script>

{#if phase !== MapPhase.None}
  <div class="map" data-testid="import-map" role="region" aria-label="Import map" data-key-region={Region.Editor}>
    <Section title="Pages" fold={Fold.Open}>
      {#if phase === MapPhase.Loading}
        <p class="muted" data-testid="import-map-loading">Reading the import…</p>
      {:else if phase === MapPhase.Error}
        <p class="muted" data-testid="import-map-error">The import map could not be read. <button class="link" onclick={() => void load()}>Retry</button></p>
      {:else if !rows.length}
        <p class="muted" data-testid="import-map-empty">This frame was imported before the import map existed. Pull once to build it.</p>
      {:else}
        <p class="muted" data-testid="import-map-room">{used} of {read?.limit} pages on this frame{room <= 0 ? ': full, import into a new frame' : ''}.</p>
        {#if read?.map?.unrun}<p class="muted">Route list unavailable: {read.map.unrun}</p>{/if}
        {#if rows.length > SEARCH_FROM}
          <input class="search" type="search" placeholder="Filter pages" aria-label="Filter pages" bind:value={query} data-testid="import-map-search" />
        {/if}
        <ul class="pages">
          {#each shown as row (row.path)}
            {@const busy = busyIn(row)}
            {@const note = noteIn(row)}
            <li class="page" data-testid="import-map-page" data-path={row.path} data-shown={row.shown}>
              <div class="line">
                {#if row.shown === Shown.OnCanvas}
                  <button class="path link" onclick={() => zoomTo(row)} title="Select and zoom to {row.path}" data-testid="import-map-zoom">{row.path}</button>
                {:else}
                  <span class="path">{row.path}</span>
                {/if}
                <span class="chip" data-tone={busy ? Tone.Idle : row.rule.tone} data-testid="import-map-chip">{busy ?? row.rule.chip}</span>
                {#if row.rule.action !== PageAction.Zoom}
                  <Button size="sm" variant="secondary" disabled={!!busy || (room <= 0 && row.rule.action !== PageAction.SignIn && row.rule.action !== PageAction.SetValue)} onclick={() => act(row)} data-testid="import-map-action">{row.rule.label}</Button>
                {/if}
              </div>
              {#if row.boards.length}
                <div class="conds">
                  {#each row.boards as board (board.clip)}<span class="cond">{condLabel(condOf(board.cond))}</span>{/each}
                  {#if room > 0}
                    <select class="add" aria-label="Add width or theme to {row.path}" disabled={!!busy} onchange={(e) => (addCondition(row, e.currentTarget.value), (e.currentTarget.value = ''))} data-testid="import-map-add">
                      <option value="">Add width/theme…</option>
                      {#each row.missing as c (condKey(c))}<option value={condKey(c)}>{condLabel(c)}</option>{/each}
                    </select>
                  {/if}
                </div>
              {/if}
              {#if row.reason}<p class="muted reason">{row.reason}</p>{/if}
              {#if editing === row.path}
                <form class="value" onsubmit={(e) => (e.preventDefault(), importValue(row))}>
                  <input list="values-{row.path}" placeholder={row.values[0] ?? row.path} aria-label="Path for {row.path}" bind:value={values[row.path]} data-testid="import-map-value" />
                  <datalist id="values-{row.path}">{#each row.values as v (v)}<option value={v}></option>{/each}</datalist>
                  <Button size="sm" type="submit" data-testid="import-map-value-import">Import</Button>
                </form>
              {/if}
              {#if note}<p class="note" role="status" data-testid="import-map-note">{note}</p>{/if}
            </li>
          {/each}
        </ul>
      {/if}
    </Section>

    {#if read?.map}
      <Section title="Components" fold={Fold.Closed}>
        {#if read.map.library}
          <p class="muted" data-testid="import-map-components">{read.map.library.captured.length} on canvas · {read.map.library.uncaptured.length} in code only</p>
          {#if read.map.library.uncaptured.length}
            <ul class="names" aria-label="Components in code only">
              {#each read.map.library.uncaptured as name (name)}<li>{name}</li>{/each}
            </ul>
          {/if}
        {:else}
          <p class="muted">No component library was read from the code.</p>
        {/if}
      </Section>

      <Section title="Tokens & styles" fold={Fold.Closed}>
        {#if read.map.design}
          <dl class="counts" data-testid="import-map-tokens">
            <dt>Tokens</dt><dd>{read.map.design.tokens}</dd>
            <dt>Styles</dt><dd>{read.map.design.styles}</dd>
            <dt>Bound layers</dt><dd>{read.map.design.bound}</dd>
            <dt>Unbound layers</dt><dd>{read.map.design.unbound}</dd>
            <dt>Read-only tokens</dt><dd>{read.readOnly}</dd>
          </dl>
        {:else}
          <p class="muted">No design tokens were imported.</p>
        {/if}
      </Section>

      <Section title="Code" fold={Fold.Open}>
        <p class="muted" data-testid="import-map-code">
          {KIND_TITLE[read.kind]} · {read.sha ? read.sha.slice(0, 7) : 'no revision'} · {upToDate === null ? 'checking…' : upToDate ? 'up to date' : 'changed since the last Pull'}
        </p>
        {#if read.kind !== 'upload'}
          <Button size="sm" variant="secondary" disabled={pulling} onclick={() => void pull()} data-testid="import-map-pull"><RefreshCw size={14} /> {pulling ? 'Pulling…' : 'Pull'}</Button>
        {/if}
        {#if pullNote}<p class="note" role="status">{pullNote}</p>{/if}
      </Section>
    {/if}
  </div>
{/if}

<style>
  .map {
    border-top: 1px solid var(--ui-divider);
    font-size: 12px;
  }
  .muted {
    margin: 0 12px 8px;
    color: var(--ui-text-3, var(--ui-text-muted));
  }
  .note {
    margin: 4px 0 0;
    color: var(--ui-text-2);
  }
  .link {
    background: none;
    border: 0;
    padding: 0;
    color: var(--ui-accent-text);
    cursor: pointer;
    text-align: left;
  }
  .link:focus-visible,
  .search:focus-visible,
  .add:focus-visible,
  .value input:focus-visible {
    outline: 2px solid var(--ui-accent);
    outline-offset: 1px;
  }
  .search,
  .value input,
  .add {
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: inherit;
    font: inherit;
  }
  .search {
    margin: 0 12px 8px;
    width: calc(100% - 24px);
  }
  .pages,
  .names {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .page {
    padding: 6px 12px;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 28px;
  }
  .path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--ui-mono);
  }
  .chip {
    padding: 2px 8px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-wash);
    color: var(--ui-text-2);
    white-space: nowrap;
  }
  .chip[data-tone='done'] {
    color: var(--ui-accent-text);
  }
  .chip[data-tone='warn'] {
    color: var(--ui-warning, #b45309);
  }
  .chip[data-tone='bad'] {
    color: var(--ui-danger, #dc2626);
  }
  .conds {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }
  .cond {
    padding: 2px 6px;
    border-radius: var(--ui-radius-xs);
    background: var(--ui-panel-sunken);
    color: var(--ui-text-2);
  }
  .reason {
    margin: 4px 0 0;
  }
  .value {
    display: flex;
    gap: 6px;
    margin-top: 6px;
  }
  .value input {
    flex: 1;
    min-width: 0;
  }
  .names {
    margin: 0 12px 8px;
    color: var(--ui-text-2);
    columns: 2;
  }
  .counts {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 12px;
    margin: 0 12px 8px;
  }
  .counts dt {
    color: var(--ui-text-2);
  }
  .counts dd {
    margin: 0;
    font-family: var(--ui-mono);
  }
  .map :global(button[data-testid='import-map-pull']) {
    margin: 0 12px 8px;
  }
</style>
