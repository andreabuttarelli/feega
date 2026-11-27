<script lang="ts">
  import { GitAfter, GitFix, GitHost, GitScope, GitState, ToHost, type ChangeRow } from '../messages';
  import { ai } from './ai-state.svelte';
  import { git } from './git-state.svelte';
  import { copyOf, expandedOf, fixLabel, gitUi } from './git-view';
  import { toHost } from './host';
  import Segmented from './Segmented.svelte';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import GitBranch from '@lucide/svelte/icons/git-branch';
  import type { Snippet } from 'svelte';

  let { changes, onai, onscm, trailing }: { changes: ChangeRow[]; onai: () => void; onscm: () => void; trailing: Snippet } = $props();

  const GITHUB_MARK = 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z';

  const SCOPES = [
    { value: GitScope.Feega, label: 'Feega edits' },
    { value: GitScope.All, label: 'All changes' }
  ];

  let scope = $state(GitScope.Feega);
  let message = $state('');
  let typed = $state(false);
  let name = $state('');
  let email = $state('');

  const ui = $derived(git.view ? gitUi(git.view, scope, message, changes.length) : null);
  const failed = $derived(git.result !== null && !git.result.ok);
  const forced = $derived(ui !== null && (ui.attention || failed));
  const expanded = $derived(git.view !== null && ui !== null && expandedOf(git.view.open, ui.attention, failed));
  const others = $derived(git.view?.others.length ?? 0);
  const agent = $derived(ai.agents.find((a) => a.installed && a.id === ai.agent) ?? ai.agents.find((a) => a.installed) ?? null);

  $effect(() => {
    void changes;
    toHost({ kind: ToHost.GitRefresh });
  });

  $effect(() => {
    toHost({ kind: ToHost.AiList });
  });

  $effect(() => {
    if (git.view && !typed) {
      message = git.view.message;
    }
  });

  function toggle() {
    toHost({ kind: ToHost.GitOpen, open: !expanded });
  }

  function begin() {
    git.pending = true;
    git.result = null;
  }

  function commit(after: GitAfter) {
    begin();
    typed = false;
    toHost({ kind: ToHost.GitCommit, message, scope, after });
  }

  function fix(kind: GitFix) {
    const copied = copyOf(kind);
    if (copied) {
      toHost({ kind: ToHost.Copy, text: copied });
      return;
    }
    if (kind === GitFix.Sync || kind === GitFix.Agent) {
      agentFix();
      return;
    }
    begin();
    if (kind === GitFix.Pull) {
      toHost({ kind: ToHost.GitPull });
    } else if (kind === GitFix.PullAndPush) {
      toHost({ kind: ToHost.GitPullPush });
    } else if (kind === GitFix.Identity) {
      toHost({ kind: ToHost.GitIdentity, name, email });
    }
  }

  function agentFix() {
    if (agent) {
      toHost({ kind: ToHost.GitFix, agent: agent.id });
    }
    onai();
  }
</script>

{#snippet alert(text: string, kind: GitFix, bad: boolean)}
  {@const label = fixLabel(kind, agent?.label ?? null)}
  <div class="alert" class:bad role="status">
    <p>{text}</p>
    {#if kind === GitFix.Identity}
      <div class="identity">
        <input bind:value={name} placeholder="Your name" aria-label="Git user name" data-testid="git-name" />
        <input bind:value={email} placeholder="you@example.com" aria-label="Git user email" data-testid="git-email" />
      </div>
    {/if}
    {#if label}<button type="button" class="fix" data-testid="git-fix" disabled={git.pending} onclick={() => fix(kind)}>{label}</button>{/if}
  </div>
{/snippet}

{#if ui && git.view}
  <section class="git" data-testid="git-commit">
    <div class="bar">
      <span class="mark" data-testid="git-mark" data-host={git.view.host} aria-hidden="true">
        {#if git.view.host === GitHost.GitHub}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d={GITHUB_MARK} /></svg>
        {:else}
          <GitBranch size={14} />
        {/if}
      </span>
      <span class="branch" data-testid="git-branch" title={ui.branchLine}>{git.view.branch ?? ui.notice?.text ?? ui.branchLine}</span>
      {#if git.view.ahead}<span class="count" title="{git.view.ahead} ahead">↑{git.view.ahead}</span>{/if}
      {#if git.view.behind}<span class="count" title="{git.view.behind} behind">↓{git.view.behind}</span>{/if}
      <span class="spacer"></span>
      {@render trailing()}
      {#if git.view.state === GitState.Ready}
        <button type="button" class="primary" data-testid="git-quick" disabled={!ui.canCommit || git.pending} onclick={() => commit(ui.primary)}>{ui.primary === GitAfter.Push ? 'Commit & push' : 'Commit'}</button>
      {/if}
      <button type="button" class="icon" class:open={expanded} aria-expanded={expanded} aria-label={expanded ? 'Collapse commit area' : 'Expand commit area'} data-testid="git-toggle" disabled={forced} onclick={toggle}><ChevronDown size={14} /></button>
    </div>
    {#if expanded}
      <div class="body">
        {#if git.view.state === GitState.Ready}
          <h3 data-testid="git-header">{ui.header}</h3>
          <textarea bind:value={message} oninput={() => (typed = true)} rows="2" placeholder="Commit message" aria-label="Commit message" data-testid="git-message"></textarea>
          <Segmented options={SCOPES} bind:value={scope} label="Files to commit" />
          {#if scope === GitScope.All && others}<p class="hint">Includes {others} {others === 1 ? 'file' : 'files'} you edited outside Feega.</p>{/if}
          {#if ui.files.length}
            <ul class="files" data-testid="git-files">
              {#each ui.files as file (file)}<li title={file}>{file}</li>{/each}
            </ul>
          {/if}
          <div class="buttons">
            {#if ui.primary === GitAfter.Push}<button type="button" data-testid="git-commit-button" disabled={!ui.canCommit || git.pending} onclick={() => commit(GitAfter.Stay)}>Commit only</button>{/if}
            {#if ui.showPush}<button type="button" data-testid="git-push" disabled={git.pending} onclick={() => toHost({ kind: ToHost.GitPush })}>Push</button>{/if}
            <button type="button" class="link" data-testid="git-scm" onclick={onscm}>Open in Source Control</button>
          </div>
        {/if}
        {#if git.result && !git.result.ok}
          {@render alert(git.result.text, git.result.fix, true)}
        {/if}
        {#if ui.notice}{@render alert(ui.notice.text, ui.notice.fix, false)}{/if}
      </div>
    {/if}
    {#if git.result?.ok}<p class="ok" role="status" data-testid="git-result">{git.result.text}</p>{/if}
  </section>
{/if}

<style>
  .git {
    border-bottom: 1px solid var(--ui-divider);
    font-size: var(--ui-text-sm);
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 8px 0 12px;
  }

  .mark {
    display: inline-grid;
    flex: none;
    color: var(--ui-text-2);
  }

  .branch {
    overflow: hidden;
    min-width: 0;
    color: var(--ui-text);
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count {
    flex: none;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .spacer {
    flex: 1;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px 12px 8px;
  }

  h3 {
    margin: 0;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
    font-weight: 500;
  }

  .hint {
    margin: 0;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  textarea,
  input {
    box-sizing: border-box;
    width: 100%;
    padding: 6px 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: inherit;
    font: inherit;
  }

  textarea {
    resize: vertical;
  }

  .files {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 84px;
    margin: 0;
    padding: 0;
    overflow: auto;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
    list-style: none;
  }

  .files li {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .buttons {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  button {
    flex: none;
    height: var(--ui-hit);
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-sm);
    white-space: nowrap;
    cursor: pointer;
  }

  button.primary {
    background: var(--ui-accent-solid, var(--ui-accent));
    color: var(--ui-accent-ink);
    font-weight: 500;
  }

  button.icon {
    display: grid;
    width: var(--ui-hit);
    padding: 0;
    place-items: center;
    background: none;
    color: var(--ui-text-2);
  }

  button.icon :global(svg) {
    transition: transform var(--ui-dur-fast);
  }

  button.icon.open :global(svg) {
    transform: rotate(180deg);
  }

  button.link {
    margin-left: auto;
    padding: 0;
    background: none;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .alert {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
  }

  .alert p {
    margin: 0;
    color: var(--ui-text-2);
  }

  .alert.bad p {
    color: var(--ui-text);
  }

  .alert .fix {
    align-self: flex-start;
    background: var(--ui-input-hover);
    color: var(--ui-accent);
  }

  .identity {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ok {
    margin: 0;
    padding: 0 12px 8px;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }
</style>
