<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { SvelteMap } from 'svelte/reactivity';
  import { SourceAction, changedRows, ciOf, CiState, filesOfPatch, filesToPush, impactOf, popoverOf, pushAskOf, pushedNote, pushLabel, rowTitle, VariantChoice, type ChangedFile, type FrameSync, type PullView, type VariantAnswer } from '$lib/canvas/source-changes';
  import { PushOutcome, pushOutcomeOf, editedFilesText } from '$lib/canvas/source-sync';

  type Anchor = { left: number; top: number };
  type Pushed = { branch: string; pull: PullView | null };

  let { projectId, canvasId, open, anchor, syncs, posterOf, assetUrl, onclose, onchanged }: { projectId: string; canvasId: string; open: FrameSync | null; anchor: Anchor | null; syncs: FrameSync[]; posterOf: (nodeId: string) => string | null; assetUrl: (assetId: string) => string; onclose: () => void; onchanged: () => Promise<unknown> } = $props();

  const DEFAULT_NAME = 'canvas-edits';
  const PATCH_FILE = 'feega-changes.patch';

  const ACTION_LABEL: Record<SourceAction, string> = { [SourceAction.Update]: 'Update', [SourceAction.ViewPr]: 'View PR', [SourceAction.MakeVariant]: 'Make variant', [SourceAction.Detach]: 'Detach' };
  const CHOICE_LABEL: Record<VariantChoice, string> = { [VariantChoice.Replace]: 'Replace original', [VariantChoice.NewRoute]: 'New route', [VariantChoice.Keep]: 'Keep on canvas' };
  const CI_LABEL: Record<CiState, string> = { [CiState.None]: 'no checks', [CiState.Running]: 'CI running', [CiState.Passed]: 'CI passed', [CiState.Failed]: 'CI failed' };

  let panel = $state(false);
  let busy = $state(false);
  let note = $state('');
  let confirming = $state(false);
  let pushed = $state<Pushed | null>(null);
  let reviewing = $state(false);
  let copied = $state(false);
  const picked = new SvelteSet<string>();
  const mains = new SvelteSet<string>();
  let asking = $state<{ nodeId: string; route: string }[]>([]);
  let answers = $state<VariantAnswer[]>([]);
  const files = new SvelteMap<string, ChangedFile[]>();

  const rows = $derived(changedRows(syncs));
  const pop = $derived(open ? popoverOf(open) : null);
  const base = $derived(`/api/v1/projects/${projectId}/github/push`);

  $effect(() => {
    if (!panel) {
      return;
    }
    for (const r of rows) {
      void loadFiles(r.nodeId);
    }
  });

  async function loadFiles(nodeId: string) {
    const body = await fetch(`/api/v1/projects/${projectId}/code-import/${nodeId}/changes`).then((r) => r.json(), () => null);
    files.set(nodeId, filesOfPatch(String(body?.patch ?? '')));
  }

  async function copyBranch(branch: string) {
    await navigator.clipboard.writeText(branch).catch(() => {});
    copied = true;
  }

  async function call(url: string, init: RequestInit) {
    const res = await fetch(url, { ...init, headers: { 'content-type': 'application/json' } }).catch(() => null);
    return (await res?.json().catch(() => null)) as Record<string, unknown> | null;
  }

  function download(files: { path: string; content: string }[]) {
    const url = URL.createObjectURL(new Blob([editedFilesText(files)], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: PATCH_FILE });
    a.click();
    URL.revokeObjectURL(url);
  }

  const ACTION_RUN: Record<SourceAction, (s: FrameSync) => Promise<void>> = {
    [SourceAction.Update]: async (s) => {
      const body = await call(`/api/v1/projects/${projectId}/code-import/${s.nodeId}/pull`, { method: 'POST', body: '{}' });
      const conflicts = (body?.conflicts as string[] | undefined) ?? [];
      note = conflicts.length ? `${conflicts.length} conflicts kept on canvas` : 'Updated from GitHub';
    },
    [SourceAction.ViewPr]: async (s) => {
      window.open(s.push?.pull?.url, '_blank', 'noopener');
    },
    [SourceAction.MakeVariant]: async (s) => {
      const body = await call(`${base}/variant`, { method: 'POST', body: JSON.stringify({ canvasId, nodeId: s.nodeId }) });
      note = body?.ok ? 'Variant made: its push asks what to do with it' : `Variant refused: ${String(body?.refusal ?? 'network')}`;
    },
    [SourceAction.Detach]: async (s) => {
      await call(`${base}?nodeId=${encodeURIComponent(s.nodeId)}`, { method: 'DELETE' });
      onclose();
    }
  };

  async function act(action: SourceAction) {
    if (!open) {
      return;
    }
    busy = true;
    await ACTION_RUN[action](open);
    await onchanged();
    busy = false;
  }

  async function push(confirmSensitive = false) {
    const ask = pushAskOf(rows, picked, DEFAULT_NAME, mains, answers);
    if (!ask) {
      return;
    }
    busy = true;
    reviewing = false;
    copied = false;
    const body = await call(base, { method: 'POST', body: JSON.stringify({ ...ask, confirmSensitive }) });
    const outcome = pushOutcomeOf(body as { ok?: boolean; refusal?: string } | null);
    confirming = outcome === PushOutcome.NeedsConfirm;
    asking = outcome === PushOutcome.VariantChoice ? ((body?.suggested as { nodeId: string; route: string }[]) ?? []) : [];
    if (outcome === PushOutcome.ReadOnly) {
      download((body?.patch as { path: string; content: string }[]) ?? []);
    }
    if (outcome === PushOutcome.Pushed) {
      pushed = { branch: String(body?.branch), pull: null };
      await onchanged();
      pushed = { branch: String(body?.branch), pull: syncs.find((s) => ask.nodeIds.includes(s.nodeId))?.push?.pull ?? null };
    }
    if (outcome === PushOutcome.Pushed) {
      answers = [];
    }
    note = outcome === PushOutcome.Failed ? `Push refused: ${String(body?.refusal ?? 'network')}` : '';
    busy = false;
  }

  function answer(v: { nodeId: string; route: string }, choice: VariantChoice) {
    answers = [...answers.filter((a) => a.nodeId !== v.nodeId), { nodeId: v.nodeId, choice, route: v.route }];
    asking = asking.filter((a) => a.nodeId !== v.nodeId);
    if (!asking.length) {
      void push();
    }
  }

  async function undo() {
    const first = rows.find((r) => r.link.pushBranch) ?? syncs.find((s) => s.link.pushBranch);
    if (!first) {
      return;
    }
    busy = true;
    const body = await call(`${base}/undo`, { method: 'POST', body: JSON.stringify({ nodeId: first.nodeId }) });
    note = body?.ok ? 'Last push undone' : `Undo refused: ${String(body?.refusal ?? 'network')}`;
    await onchanged();
    busy = false;
  }

  const hasPush = $derived(syncs.some((s) => s.link.pushBranch));
  const readOnly = $derived(rows.some((r) => !r.link.writable));
  const toPush = $derived(filesToPush(picked, files));
</script>

{#if open && pop && anchor}
  <div class="source-pop" data-testid="source-popover" style="left:{anchor.left}px;top:{anchor.top}px">
    <div class="row"><span class="label">File</span><code>{pop.file}</code></div>
    <div class="row"><span class="label">Commit</span><code>{pop.commit}</code> <span class="muted">on {pop.branch}</span></div>
    <div class="row"><span class="label">State</span><span>{open.state.replace('_', ' ')}</span></div>
    {#if note}<p class="note">{note}</p>{/if}
    <div class="actions">
      {#each pop.actions as action (action)}
        <button type="button" disabled={busy} onclick={() => act(action)}>{ACTION_LABEL[action]}</button>
      {/each}
      <button type="button" onclick={() => ((panel = true), onclose())}>Changes</button>
    </div>
  </div>
{/if}

{#if panel}
  <aside class="changes" data-testid="changes-panel">
    <header><strong>Changes</strong><button type="button" aria-label="Close" onclick={() => (panel = false)}>×</button></header>
    {#if !rows.length}<p class="muted">No linked frame changed since its last sync.</p>{/if}
    {#each rows as row (row.nodeId)}
      <label class="change">
        <input type="checkbox" checked={picked.has(row.nodeId)} onchange={(e) => (e.currentTarget.checked ? picked.add(row.nodeId) : picked.delete(row.nodeId))} />
        {#if row.link.beforePoster}<img src={assetUrl(row.link.beforePoster)} alt="Before" title="Before" />{/if}
        {#if posterOf(row.nodeId)}<img src={posterOf(row.nodeId)} alt="After" title="After" />{/if}
        <span><strong>{rowTitle(row)}</strong> <span class="muted">{row.state}</span>{#if impactOf(row)}<br /><span class="note">{impactOf(row)}</span>{/if}</span>
      </label>
      {#each files.get(row.nodeId) ?? [] as file (file.path)}
        <details class="file">
          <summary><code>{file.path}</code></summary>
          <pre>{file.diff}</pre>
        </details>
      {/each}
      {#each row.proposals ?? [] as p (p.component)}
        <p class="muted">No prop on <code>{p.component}</code> for {p.props.join(', ')}: ask the agent to add one, or apply to the main component.</p>
      {/each}
      <label class="change"><input type="checkbox" checked={mains.has(row.nodeId)} onchange={(e) => (e.currentTarget.checked ? mains.add(row.nodeId) : mains.delete(row.nodeId))} /> Apply instance edits to main component</label>
    {/each}
    {#each asking as v (v.nodeId)}
      <p class="note">{syncs.find((s) => s.nodeId === v.nodeId)?.name || 'Variant'} is a variant:</p>
      <input aria-label="New route" bind:value={v.route} />
      <div class="actions">
        {#each Object.values(VariantChoice) as choice (choice)}
          <button type="button" disabled={busy} onclick={() => answer(v, choice)}>{CHOICE_LABEL[choice]}</button>
        {/each}
      </div>
    {/each}
    {#if confirming}
      <p class="note">This push touches config, lockfiles or dotfiles.</p>
      <button type="button" disabled={busy} onclick={() => push(true)}>Push anyway</button>
    {/if}
    {#if note}<p class="note">{note}</p>{/if}
    {#if pushed}
      <p class="pushed" data-testid="pushed-note">{pushedNote(pushed)}{#if pushed.pull} · <a href={pushed.pull.url} target="_blank" rel="noopener">open</a> · {CI_LABEL[ciOf(pushed.pull)]}{/if}</p>
      {#if !pushed.pull}
        <button type="button" onclick={() => copyBranch(pushed!.branch)}>{copied ? 'Branch copied' : 'Copy branch'}</button>
      {/if}
    {/if}
    {#if reviewing}
      <div class="review" data-testid="push-review">
        <p>These files will be pushed:</p>
        <ul>
          {#each toPush as path (path)}<li><code>{path}</code></li>{/each}
        </ul>
        <button type="button" class="primary" disabled={busy || !toPush.length} onclick={() => push()}>Push {toPush.length} files</button>
        <button type="button" onclick={() => (reviewing = false)}>Back</button>
      </div>
    {/if}
    <footer>
      {#if readOnly}
        <button type="button" disabled={busy || !picked.size} onclick={() => push()}>Download patch</button>
      {:else}
        <button type="button" class="primary" disabled={busy || !picked.size || reviewing} onclick={() => (reviewing = true)}>{pushLabel(rows)}</button>
      {/if}
      <button type="button" disabled={busy || !hasPush} onclick={undo}>Undo last push</button>
    </footer>
  </aside>
{/if}

<style>
  .source-pop,
  .changes {
    position: absolute;
    z-index: 30;
    background: var(--ui-surface, #fff);
    color: var(--ui-text, inherit);
    border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.1));
    border-radius: var(--ui-radius-md);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    font-size: 12px;
    pointer-events: auto;
  }
  .source-pop {
    width: 280px;
    padding: 10px;
  }
  .changes {
    top: 72px;
    left: 72px;
    width: 320px;
    max-height: 70vh;
    overflow: auto;
    padding: 12px;
    border-radius: var(--ui-radius-lg);
  }
  .row {
    display: flex;
    gap: 6px;
    align-items: baseline;
    margin-bottom: 4px;
  }
  .label {
    width: 52px;
    opacity: 0.6;
  }
  .muted {
    opacity: 0.6;
  }
  .actions,
  footer {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 8px;
  }
  header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .change {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 6px 0;
  }
  .change img {
    width: 48px;
    height: 32px;
    object-fit: cover;
    border-radius: var(--ui-radius-xs);
  }
  button {
    border: 1px solid var(--ui-border, rgba(0, 0, 0, 0.15));
    border-radius: var(--ui-radius-sm);
    background: transparent;
    padding: 4px 8px;
    cursor: pointer;
    color: inherit;
  }
  button.primary {
    background: var(--ui-text, #111);
    color: var(--ui-surface, #fff);
  }
  .file pre {
    max-height: 120px;
    overflow: auto;
    margin: 4px 0;
    font-size: 11px;
    white-space: pre;
  }
  .review ul {
    margin: 4px 0 8px;
    padding-left: 16px;
  }
  .note {
    margin: 6px 0;
  }
</style>
