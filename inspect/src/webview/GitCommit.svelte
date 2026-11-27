<script lang="ts">
  import { GitAfter, GitFix, GitScope, GitState, ToHost, type ChangeRow } from '../messages';
  import { ai } from './ai-state.svelte';
  import { git } from './git-state.svelte';
  import { copyOf, fixLabel, gitUi } from './git-view';
  import { toHost } from './host';
  import Segmented from './Segmented.svelte';

  let { changes, onai }: { changes: ChangeRow[]; onai: () => void } = $props();

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
    {#if ui.header}<h3 data-testid="git-header">{ui.header}</h3>{/if}
    {#if ui.branchLine}<div class="branch" data-testid="git-branch">{ui.branchLine}</div>{/if}
    {#if git.view.state === GitState.Ready}
      <textarea bind:value={message} oninput={() => (typed = true)} rows="2" placeholder="Commit message" aria-label="Commit message" data-testid="git-message"></textarea>
      <Segmented options={SCOPES} bind:value={scope} label="Files to commit" />
      {#if scope === GitScope.All && others}<p class="hint">Includes {others} {others === 1 ? 'file' : 'files'} you edited outside Feega.</p>{/if}
      {#if ui.files.length}
        <ul class="files" data-testid="git-files">
          {#each ui.files as file (file)}<li title={file}>{file}</li>{/each}
        </ul>
      {/if}
      <div class="buttons">
        {#if ui.primary === GitAfter.Push}
          <button type="button" class="primary" data-testid="git-commit-push" disabled={!ui.canCommit || git.pending} onclick={() => commit(GitAfter.Push)}>Commit &amp; push</button>
          <button type="button" data-testid="git-commit-button" disabled={!ui.canCommit || git.pending} onclick={() => commit(GitAfter.Stay)}>Commit</button>
        {:else}
          <button type="button" class="primary" data-testid="git-commit-button" disabled={!ui.canCommit || git.pending} onclick={() => commit(GitAfter.Stay)}>Commit</button>
        {/if}
        {#if ui.showPush}<button type="button" data-testid="git-push" disabled={git.pending} onclick={() => toHost({ kind: ToHost.GitPush })}>Push</button>{/if}
      </div>
    {/if}
    {#if git.result && !git.result.ok}
      {@render alert(git.result.text, git.result.fix, true)}
    {:else if git.result}
      <p class="ok" role="status" data-testid="git-result">{git.result.text}</p>
    {/if}
    {#if ui.notice}{@render alert(ui.notice.text, ui.notice.fix, false)}{/if}
  </section>
{/if}

<style>
  .git {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 12px 12px;
    border-bottom: 1px solid var(--ui-divider);
    font-size: var(--ui-text-sm);
  }

  h3 {
    margin: 0;
    font-size: var(--ui-text-md);
    font-weight: 600;
  }

  .branch,
  .hint {
    margin: 0;
    color: var(--ui-text-2);
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
    box-shadow: 0 0 0 1px var(--ui-divider);
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
    max-height: 96px;
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
    gap: 6px;
  }

  button {
    padding: 0 10px;
    height: 28px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    white-space: nowrap;
    cursor: pointer;
  }

  button.primary {
    flex: 1;
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
  }

  button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .alert {
    display: flex;
    flex-direction: column;
    gap: 8px;
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
    color: var(--ui-text-2);
  }
</style>
