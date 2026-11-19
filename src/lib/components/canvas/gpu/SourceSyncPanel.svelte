<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { SvelteMap } from 'svelte/reactivity';
  import { SourceAction, changedRows, ciOf, CiState, filesOfPatch, impactOf, popoverOf, pushAskOf, pushedNote, rowTitle, VariantChoice, type ChangedFile, type FrameSync, type PullView, type VariantAnswer } from '$lib/canvas/source-changes';
  import { PushOutcome, pushOutcomeOf, editedFilesText } from '$lib/canvas/source-sync';
  import type { GitSummary } from '$lib/canvas/git-status';
  import type { GitSession } from '$lib/canvas/git-session.svelte';
  import GitBranch from '@lucide/svelte/icons/git-branch';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import X from '@lucide/svelte/icons/x';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Frame from '@lucide/svelte/icons/frame';
  import GitCommitHorizontal from '@lucide/svelte/icons/git-commit-horizontal';
  import GitPullRequest from '@lucide/svelte/icons/git-pull-request';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import CloudCheck from '@lucide/svelte/icons/cloud-check';
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { OptionMenu, Switch } from '$lib/components/ui/control';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';

  type Anchor = { left: number; top: number };
  type Pushed = { branch: string; pull: PullView | null };

  let { projectId, canvasId, open, anchor, syncs, posterOf, assetUrl, onclose, onchanged, oncompare, panel = $bindable(false), git = null, work }: { panel?: boolean; git?: GitSummary | null; work: GitSession; projectId: string; canvasId: string; open: FrameSync | null; anchor: Anchor | null; syncs: FrameSync[]; posterOf: (nodeId: string) => string | null; assetUrl: (assetId: string) => string; onclose: () => void; onchanged: () => Promise<unknown>; oncompare: (nodeId: string) => void } = $props();

  const DEFAULT_NAME = 'canvas-edits';
  const PROTECTED = 'protected';
  const PATCH_FILE = 'feega-changes.patch';

  const ACTION_LABEL: Record<SourceAction, string> = { [SourceAction.Update]: 'Update', [SourceAction.Resolve]: 'Resolve', [SourceAction.ViewPr]: 'View PR', [SourceAction.MakeVariant]: 'Make variant', [SourceAction.Detach]: 'Detach' };
  const CHOICE_LABEL: Record<VariantChoice, string> = { [VariantChoice.Replace]: 'Replace original', [VariantChoice.NewRoute]: 'New route', [VariantChoice.Keep]: 'Keep on canvas' };
  const CI_LABEL: Record<CiState, string> = { [CiState.None]: 'no checks', [CiState.Running]: 'CI running', [CiState.Passed]: 'CI passed', [CiState.Failed]: 'CI failed' };

  let busy = $state(false);
  let note = $state('');
  let confirming = $state(false);
  let pushed = $state<Pushed | null>(null);
  let copied = $state(false);
  const mains = new SvelteSet<string>();
  let asking = $state<{ nodeId: string; route: string }[]>([]);
  let answers = $state<VariantAnswer[]>([]);
  let split = $state<{ nodeId: string; files: { path: string; canvas: string; github: string }[] } | null>(null);
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
    [SourceAction.Resolve]: async (s) => {
      const body = await call(`${base}/conflicts?nodeId=${encodeURIComponent(s.nodeId)}`, { method: 'GET' });
      split = body?.ok ? { nodeId: s.nodeId, files: (body.files as { path: string; canvas: string; github: string }[]) ?? [] } : null;
      note = body?.ok ? '' : `Conflicts unavailable: ${String(body?.refusal ?? 'network')}`;
    },
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
    const ask = pushAskOf(rows, new Set(rows.map((r) => r.nodeId)), DEFAULT_NAME, mains, answers);
    if (!ask) {
      return;
    }
    busy = true;
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
    note = outcome === PushOutcome.Failed ? refusalNote(String(body?.refusal ?? 'network')) : '';
    busy = false;
  }

  const refusalNote = (refusal: string) => (refusal === PROTECTED ? `GitHub refused the commit: ${workBranch ?? 'the branch'} is protected. Choose another branch.` : `Push refused: ${refusal}`);

  function answer(v: { nodeId: string; route: string }, choice: VariantChoice) {
    answers = [...answers.filter((a) => a.nodeId !== v.nodeId), { nodeId: v.nodeId, choice, route: v.route }];
    asking = asking.filter((a) => a.nodeId !== v.nodeId);
    if (!asking.length) {
      void push();
    }
  }

  async function keepCanvas() {
    if (!split) {
      return;
    }
    busy = true;
    const body = await call(`${base}/conflicts`, { method: 'POST', body: JSON.stringify({ nodeId: split.nodeId, choice: 'keep_canvas' }) });
    note = body?.ok ? 'Canvas kept: the next push writes it' : `Refused: ${String(body?.refusal ?? 'network')}`;
    split = null;
    await onchanged();
    busy = false;
  }

  async function takeGithub() {
    const s = syncs.find((x) => x.nodeId === split?.nodeId);
    split = null;
    if (s) {
      busy = true;
      await ACTION_RUN[SourceAction.Update](s);
      await onchanged();
      busy = false;
    }
  }

  async function withAgent() {
    if (!split) {
      return;
    }
    const body = await call(`${base}/conflicts`, { method: 'POST', body: JSON.stringify({ nodeId: split.nodeId, choice: 'agent' }) });
    await navigator.clipboard?.writeText(String(body?.prompt ?? '')).catch(() => null);
    note = 'Merge prompt copied: paste it to the agent';
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
  type BranchPull = { number: number; branch: string };
  type CommitRow = { sha: string; message: string; author: string; at: string };
  const NEW_BRANCH = '__new__';
  const COMMITS_SHOWN = 5;
  const MINUTE_MS = 60_000;
  let branches = $state<string[]>([]);
  let branchPulls = $state<BranchPull[]>([]);
  let commits = $state<CommitRow[]>([]);
  let picking = $state(false);
  let choice = $state('');
  let newName = $state('');
  let newFrom = $state('');
  let message = $state('');
  let pullBase = $state('');
  const lead = $derived(git?.nodeId ?? syncs[0]?.nodeId ?? '');
  const workBranch = $derived(git?.branch ?? null);
  const choosing = $derived(!workBranch || picking);
  const imported = $derived(git?.imported ?? syncs[0]?.link.baseBranch ?? 'main');
  const branchOptions = $derived([...branches.map((b) => ({ value: b, label: b })), { value: NEW_BRANCH, label: 'New branch…' }]);
  const pullTargets = $derived(branches.filter((b) => b !== workBranch).map((b) => ({ value: b, label: b })));
  const pullTarget = $derived(pullBase || (imported !== workBranch ? imported : (pullTargets[0]?.value ?? '')));
  const branchPull = $derived(branchPulls.find((p) => p.branch === workBranch) ?? null);
  const savedAgo = (ms: number) => (ms < MINUTE_MS ? 'Saved just now' : `Saved ${Math.round(ms / MINUTE_MS)} min ago`);
  const savedLabel = $derived(!work.autosaveOn ? 'Off: commit by hand' : work.savedAt ? savedAgo(Date.now() - work.savedAt) : workBranch ? 'Not saved yet' : 'Waiting for a branch');
  const readOnly = $derived(rows.some((r) => !r.link.writable));
  const agoOf = (at: string) => {
    const minutes = Math.max(0, Math.round((Date.now() - Date.parse(at)) / MINUTE_MS));
    return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
  };

  $effect(() => {
    if (!panel || !lead) {
      return;
    }
    void loadRefs(lead, workBranch);
  });

  $effect(() => {
    if (choosing && !choice) {
      choice = imported;
    }
  });

  $effect(() => {
    if (panel && !message) {
      message = work.draftMessage().split('\n')[0];
    }
  });

  async function loadRefs(nodeId: string, ref: string | null) {
    const body = await call(`/api/v1/projects/${projectId}/github/versions`, { method: 'POST', body: JSON.stringify({ nodeId, ...(ref ? { ref } : {}), limit: COMMITS_SHOWN }) });
    const refs = (body?.refs as { name: string; kind: string }[] | undefined) ?? [];
    branches = refs.filter((r) => r.kind === 'branch').map((r) => r.name);
    branchPulls = (body?.pulls as BranchPull[] | undefined) ?? [];
    commits = ref ? ((body?.commits as CommitRow[] | undefined) ?? []).slice(0, COMMITS_SHOWN) : [];
  }

  async function confirmBranch() {
    const isNew = choice === NEW_BRANCH;
    const name = isNew ? newName.trim() : choice;
    if (!name) {
      return;
    }
    busy = true;
    const body = await work.choose(name, isNew ? newFrom || imported : undefined);
    if (body?.ok) {
      picking = false;
      await loadRefs(lead, name);
    }
    busy = false;
  }

  async function commitNow() {
    busy = true;
    await work.commit(message.trim() || undefined);
    message = '';
    await loadRefs(lead, workBranch);
    busy = false;
  }

  const commitLabel = $derived(git && !git.caps.wip && git.caps.publish ? 'Commit and push' : 'Commit now');

  async function connectGithub() {
    const body = await call(`/api/v1/projects/${projectId}/github/connect`, { method: 'POST', body: JSON.stringify({ returnTo: location.pathname }) });
    if (typeof body?.url === 'string') {
      location.assign(body.url);
    }
  }

  async function openPullRequest() {
    if (!pullTarget) {
      return;
    }
    busy = true;
    await work.openPull(lead, pullTarget);
    await loadRefs(lead, workBranch);
    busy = false;
  }
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
      <button type="button" data-testid="compare-versions" onclick={() => oncompare(open.nodeId)}>Compare versions</button>
    </div>
  </div>
{/if}

{#if split}
  <aside class="split" data-testid="conflict-split">
    <header><strong>Conflicts</strong><button type="button" aria-label="Close" onclick={() => (split = null)}>×</button></header>
    {#each split.files as f (f.path)}
      <code>{f.path}</code>
      <div class="sides">
        <section><span class="label">Canvas</span><pre>{f.canvas}</pre></section>
        <section><span class="label">GitHub</span><pre>{f.github}</pre></section>
      </div>
    {/each}
    <footer>
      <button type="button" disabled={busy} onclick={keepCanvas}>Keep canvas</button>
      <button type="button" disabled={busy} onclick={takeGithub}>Take GitHub</button>
      <button type="button" disabled={busy} onclick={withAgent}>Resolve with agent</button>
    </footer>
  </aside>
{/if}

{#if panel}
  <aside class="changes" data-testid="changes-panel" aria-label="Changes">
    <header class="cp-head">
      <div class="cp-title">
        <strong>{git?.repo ?? 'Changes'}</strong>
        <button type="button" class="cp-branch" onclick={() => (picking = !picking)} data-testid="panel-branch">
          <GitBranch size={12} />
          {#if workBranch}<code>{workBranch}</code>{:else}<span>Choose a branch</span>{/if}
          <ChevronDown size={12} />
        </button>
      </div>
      {#if git?.pull}
        <a class="cp-pill" href={git.pull.url} target="_blank" rel="noopener">
          #{git.pull.number} · {git.draft ? 'Draft' : git.pull.status}
          {#if git.ci !== CiState.None}<span class="cp-ci cp-ci-{git.ci}"></span>{/if}
        </a>
      {/if}
      <Button variant="ghost" size="icon-sm" aria-label="Close" onclick={() => (panel = false)}><X size={14} /></Button>
    </header>

    {#if choosing}
      <div class="cp-section">
        <p class="cp-label">Save edits to</p>
        <section class="cp-card cp-stack" data-testid="branch-choice">
          {#if !workBranch}<p class="cp-muted">Nothing is written to GitHub until you choose. Edits stay on the canvas meanwhile.</p>{/if}
          <OptionMenu label="Branch" value={choice} options={branchOptions} onchange={(v) => (choice = String(v))} />
          {#if choice === NEW_BRANCH}
            <label class="cp-field-label" for="new-branch">Name</label>
            <Input id="new-branch" placeholder="design/hero-refresh" bind:value={newName} data-testid="new-branch" />
            <label class="cp-field-label" for="new-from">From</label>
            <OptionMenu label="From" value={newFrom || imported} options={branches.map((b) => ({ value: b, label: b }))} onchange={(v) => (newFrom = String(v))} />
          {/if}
          <Button size="sm" disabled={busy || (choice === NEW_BRANCH && !newName.trim())} onclick={confirmBranch} data-testid="branch-confirm">Save edits to {choice === NEW_BRANCH ? newName.trim() || 'new branch' : choice}</Button>
        </section>
      </div>
    {/if}

    <div class="cp-section">
      <p class="cp-label">Changes {#if rows.length}<span class="cp-count">{rows.length}</span>{/if}</p>
      <section class="cp-card">
        {#if !rows.length}
          <p class="cp-empty" data-testid="changes-empty"><GitCommitHorizontal size={16} /> No changes yet. Edit a linked frame and it is saved here.</p>
        {/if}
        {#each rows as row (row.nodeId)}
          <div class="cp-row">
            {#if posterOf(row.nodeId)}
              <img class="cp-thumb" src={posterOf(row.nodeId)} alt="After" title="After" />
            {:else if row.link.beforePoster}
              <img class="cp-thumb" src={assetUrl(row.link.beforePoster)} alt="Before" title="Before" />
            {:else}
              <span class="cp-thumb cp-thumb-empty"><Frame size={14} /></span>
            {/if}
            <span class="cp-row-text">
              <span><strong>{rowTitle(row)}</strong> <span class="cp-muted">{row.state}</span></span>
              {#if impactOf(row)}<span class="cp-muted">{impactOf(row)}</span>{/if}
            </span>
          </div>
          {#each files.get(row.nodeId) ?? [] as file (file.path)}
            <details class="cp-file">
              <summary><code>{file.path}</code></summary>
              <pre>{file.diff}</pre>
            </details>
          {/each}
          {#each row.proposals ?? [] as p (p.component)}
            <p class="cp-muted">No prop on <code>{p.component}</code> for {p.props.join(', ')}: ask the agent to add one, or apply to the main component.</p>
          {/each}
          <label class="cp-row cp-row-sub"><input type="checkbox" checked={mains.has(row.nodeId)} onchange={(e) => (e.currentTarget.checked ? mains.add(row.nodeId) : mains.delete(row.nodeId))} /> Apply instance edits to main component</label>
        {/each}
        {#if rows.length && workBranch}
          <div class="cp-commit">
            <Input aria-label="Commit message" bind:value={message} data-testid="commit-message" />
            <Button size="sm" disabled={busy || readOnly} onclick={commitNow} data-testid="commit-now">{commitLabel}</Button>
          </div>
        {/if}
      </section>
    </div>

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
    {#if note || work.note}<p class="cp-note" data-testid="changes-note"><TriangleAlert size={14} /><span>{note || work.note}</span></p>{/if}
    {#if pushed}
      <p class="pushed" data-testid="pushed-note">{pushedNote(pushed)}{#if pushed.pull} · <a href={pushed.pull.url} target="_blank" rel="noopener">open</a> · {CI_LABEL[ciOf(pushed.pull)]}{/if}</p>
      {#if !pushed.pull}
        <button type="button" onclick={() => copyBranch(pushed!.branch)}>{copied ? 'Branch copied' : 'Copy branch'}</button>
      {/if}
    {/if}
    {#if workBranch}
      <div class="cp-section">
        <p class="cp-label">Commits on <code class="cp-ref">{workBranch}</code></p>
        <section class="cp-card" data-testid="commit-list">
          {#each commits as c (c.sha)}
            <div class="cp-commit-row">
              <GitCommitHorizontal size={14} />
              <span class="cp-row-text"><span class="cp-ellipsis">{c.message}</span><span class="cp-muted">{c.author} · {agoOf(c.at)} · <code>{c.sha.slice(0, 7)}</code></span></span>
            </div>
          {:else}
            <p class="cp-empty">No commits yet.</p>
          {/each}
        </section>
      </div>

      {#if git?.caps.pulls !== 'none'}<div class="cp-section">
        <p class="cp-label">Pull request</p>
        <section class="cp-card cp-stack" data-testid="pull-section">
          {#if git?.pull || branchPull}
            <div class="cp-pr-open">
              <GitPullRequest size={14} />
              <span class="cp-row-text"><span>#{git?.pull?.number ?? branchPull?.number} from <code>{workBranch}</code></span><span class="cp-muted">{git?.draft ? 'Draft: mark it ready from the top bar' : 'Open'}{#if git?.pull && git.ci !== CiState.None} · {CI_LABEL[git.ci]}{/if}</span></span>
            </div>
          {:else if git?.caps.pulls === 'connect'}
            <p class="cp-muted">Pull requests go through your GitHub account.</p>
            <Button size="sm" variant="secondary" disabled={busy} onclick={connectGithub} data-testid="connect-github">Connect GitHub</Button>
          {:else if pullTargets.length}
            <div class="cp-pr-target">
              <span>Into</span>
              <OptionMenu label="Target branch" value={pullTarget} options={pullTargets} onchange={(v) => (pullBase = String(v))} />
            </div>
            <Button size="sm" variant="secondary" disabled={busy} onclick={openPullRequest} data-testid="open-pull">Open pull request</Button>
          {:else}
            <p class="cp-muted">Commits land on {workBranch} directly.</p>
          {/if}
        </section>
      </div>{/if}
    {/if}

    <div class="cp-section">
      <p class="cp-label">Autosave</p>
      <section class="cp-card cp-autosave" data-testid="last-saved">
        <span class="cp-save-icon cp-save-{git?.autosave ?? 'idle'}"><CloudCheck size={16} /></span>
        <span class="cp-row-text"><span>Save edits to code as you work</span><span class="cp-muted">{savedLabel}</span></span>
        <Switch label="Autosave" value={work.autosaveOn} onchange={(v) => (work.autosaveOn = v === true)} />
      </section>
    </div>

    <footer class="cp-foot">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger class="cp-more" aria-label="More" data-testid="changes-more"><Ellipsis size={16} /></DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" collisionPadding={8}>
          <DropdownMenu.Item disabled={busy || !hasPush} onSelect={undo}>Undo last commit</DropdownMenu.Item>
          {#if readOnly}<DropdownMenu.Item onSelect={() => push()}>Download patch</DropdownMenu.Item>{/if}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <span class="cp-muted cp-foot-note">Commits every few minutes of idle, or when you leave.</span>
    </footer>
  </aside>
{/if}

<style>
  .source-pop,
  .changes,
  .split {
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
    position: fixed;
    top: 56px;
    right: 10px;
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-4);
    width: 360px;
    max-height: calc(100vh - 72px);
    overflow: auto;
    padding: var(--ui-space-4);
    border: 0;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
    font-size: var(--ui-type-label);
  }
  .cp-head {
    display: flex;
    align-items: flex-start;
    gap: var(--ui-space-2);
    margin: 0;
  }
  .cp-title {
    display: grid;
    flex: 1;
    gap: 6px;
    min-width: 0;
  }
  .cp-title strong {
    font-size: var(--ui-type-body);
    font-weight: var(--ui-weight-semibold);
  }
  .cp-flow {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    color: var(--ui-text-tertiary);
  }
  .cp-ref {
    overflow: hidden;
    padding: 2px 6px;
    border-radius: var(--ui-radius-xs);
    background: var(--ui-wash);
    color: var(--ui-text-secondary);
    font-family: var(--ui-mono);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cp-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-wash);
    color: var(--ui-text);
    text-decoration: none;
    white-space: nowrap;
  }
  .cp-pill-inline {
    justify-self: start;
    background: var(--ui-accent-wash);
    color: var(--ui-accent-text);
  }
  .cp-ci {
    width: 6px;
    height: 6px;
    border-radius: var(--ui-radius-full);
  }
  .cp-ci-passed {
    background: var(--ui-ok);
  }
  .cp-ci-failed {
    background: var(--ui-danger);
  }
  .cp-ci-running {
    background: var(--ui-warn);
  }
  .cp-section {
    display: grid;
    gap: 6px;
  }
  .cp-label {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    padding-inline: 2px;
    color: var(--ui-text-secondary);
    font-weight: var(--ui-weight-medium);
  }
  .cp-count {
    padding: 0 6px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-wash);
    color: var(--ui-text-tertiary);
    font-size: 11px;
  }
  .cp-card {
    display: grid;
    gap: 2px;
    padding: var(--ui-space-3);
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel-sunken);
  }
  .cp-stack {
    gap: var(--ui-space-2);
  }
  .cp-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border-radius: var(--ui-radius-sm);
    cursor: pointer;
  }
  .cp-row:hover {
    background: var(--ui-hover);
  }
  .cp-row-sub {
    padding-block: 6px;
    color: var(--ui-text-secondary);
  }
  .cp-thumb {
    flex: none;
    width: 32px;
    height: 32px;
    object-fit: cover;
    border-radius: var(--ui-radius-sm);
  }
  .cp-thumb-empty {
    display: grid;
    place-items: center;
    background: var(--ui-wash);
    color: var(--ui-text-tertiary);
  }
  .cp-row-text {
    display: grid;
    flex: 1;
    gap: 2px;
    min-width: 0;
  }
  .cp-path {
    overflow: hidden;
    color: var(--ui-text-tertiary);
    font-family: var(--ui-mono);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cp-muted {
    color: var(--ui-text-tertiary);
  }
  .cp-file {
    padding: 4px 8px;
  }
  .cp-file pre {
    max-height: 120px;
    overflow: auto;
    font-size: 11px;
  }
  .cp-empty {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: var(--ui-space-2);
    color: var(--ui-text-secondary);
  }
  .cp-field-label {
    margin-top: 4px;
    color: var(--ui-text-secondary);
  }
  .cp-note,
  .cp-warn {
    display: flex;
    gap: 8px;
    margin: 0;
    padding: 8px 10px;
    border-radius: var(--ui-radius-sm);
    background: color-mix(in srgb, var(--ui-warn) 14%, transparent);
    color: var(--ui-text);
  }
  .cp-note :global(svg),
  .cp-warn :global(svg) {
    flex: none;
    margin-top: 1px;
    color: var(--ui-warn);
  }
  .cp-autosave {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .cp-save-icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-wash);
    color: var(--ui-text-secondary);
  }
  .cp-save-saved {
    color: var(--ui-ok);
  }
  .cp-save-conflict,
  .cp-save-paused {
    color: var(--ui-warn);
  }
  .cp-save-failed {
    color: var(--ui-danger);
  }
  .cp-branch {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    justify-self: start;
    max-width: 100%;
    padding: 3px 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-wash);
    color: var(--ui-text-secondary);
    cursor: pointer;
  }
  .cp-branch:hover {
    background: var(--ui-hover);
    color: var(--ui-text);
  }
  .cp-branch code {
    overflow: hidden;
    font-family: var(--ui-mono);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .changes input[type='checkbox'] {
    accent-color: var(--ui-accent);
  }
  .cp-commit {
    display: flex;
    gap: var(--ui-space-2);
    margin-top: var(--ui-space-2);
  }
  .cp-commit-row,
  .cp-pr-open {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px;
    border-radius: var(--ui-radius-sm);
    color: var(--ui-text-secondary);
  }
  .cp-commit-row + .cp-commit-row {
    border-top: 1px solid var(--ui-divider);
    border-radius: 0;
  }
  .cp-ellipsis {
    overflow: hidden;
    color: var(--ui-text);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cp-pr-target {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: var(--ui-space-2);
  }
  .cp-foot-note {
    font-size: 11px;
  }
  .cp-foot {
    position: sticky;
    bottom: calc(-1 * var(--ui-space-4));
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    margin: 0 calc(-1 * var(--ui-space-4)) calc(-1 * var(--ui-space-4));
    padding: var(--ui-space-2) var(--ui-space-4) var(--ui-space-4);
    background: var(--ui-panel-raised);
  }
  .cp-foot :global(.cp-primary) {
    flex: 1;
    border-radius: var(--ui-radius-sm);
  }
  .changes :global(.cp-more) {
    display: grid;
    place-items: center;
    width: 36px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-secondary);
  }
  .changes :global(.cp-more:hover) {
    background: var(--ui-hover);
  }
  .split {
    top: 56px;
    left: 50%;
    transform: translateX(-50%);
    width: min(960px, calc(100vw - 32px));
    max-height: 80vh;
    overflow: auto;
    padding: 12px;
    border-radius: var(--ui-radius-lg);
  }
  .sides {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 6px 0 12px;
  }
  .sides pre {
    margin: 4px 0 0;
    max-height: 40vh;
    overflow: auto;
    font-size: 11px;
    white-space: pre-wrap;
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
