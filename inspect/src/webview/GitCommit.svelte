<script lang="ts">
  import { GitAfter, GitScope, GitState, ToHost, type ChangeRow } from '../messages';
  import { git } from './git-state.svelte';
  import { gitUi } from './git-view';
  import { toHost } from './host';

  let { changes }: { changes: ChangeRow[] } = $props();

  let scope = $state(GitScope.Feega);
  let message = $state('');
  let typed = $state(false);

  const ui = $derived(git.view ? gitUi(git.view, scope, message) : null);
  const others = $derived(git.view?.others.length ?? 0);

  $effect(() => {
    void changes;
    toHost({ kind: ToHost.GitRefresh });
  });

  $effect(() => {
    if (git.view && !typed) {
      message = git.view.message;
    }
  });

  function commit(after: GitAfter) {
    git.pending = true;
    git.result = null;
    typed = false;
    toHost({ kind: ToHost.GitCommit, message, scope, after });
  }

  function run(kind: ToHost.GitPush | ToHost.GitPull) {
    git.pending = true;
    git.result = null;
    toHost({ kind });
  }
</script>

{#if ui && git.view}
  <section class="git" data-testid="git-commit">
    {#if ui.branchLine}<div class="branch" data-testid="git-branch">{ui.branchLine}</div>{/if}
    {#if git.view.state === GitState.Ready}
      <textarea bind:value={message} oninput={() => (typed = true)} rows="2" placeholder="Commit message" aria-label="Commit message" data-testid="git-message"></textarea>
      <div class="scope" role="radiogroup" aria-label="Files to commit">
        <label><input type="radio" bind:group={scope} value={GitScope.Feega} />Files Feega edited</label>
        <label><input type="radio" bind:group={scope} value={GitScope.All} />All changes{others ? ` (+${others})` : ''}</label>
      </div>
      {#if ui.files.length}
        <ul class="files" data-testid="git-files">
          {#each ui.files as file (file)}<li title={file}>{file}</li>{/each}
        </ul>
      {/if}
      <div class="buttons">
        <button type="button" class="primary" data-testid="git-commit-button" disabled={!ui.canCommit || git.pending} onclick={() => commit(GitAfter.Stay)}>Commit</button>
        <button type="button" data-testid="git-commit-push" disabled={!ui.canCommit || git.pending || !git.view.remote} onclick={() => commit(GitAfter.Push)}>Commit &amp; push</button>
        <button type="button" data-testid="git-push" disabled={!ui.canPush || git.pending} onclick={() => run(ToHost.GitPush)}>Push</button>
        {#if ui.canPull || git.result?.pull}<button type="button" data-testid="git-pull" disabled={git.pending} onclick={() => run(ToHost.GitPull)}>Pull</button>{/if}
      </div>
    {/if}
    {#if ui.notice}<p class="notice" data-testid="git-notice">{ui.notice}</p>{/if}
    {#if git.result}<p class="notice" class:bad={!git.result.ok} role="status" data-testid="git-result">{git.result.text}</p>{/if}
  </section>
{/if}

<style>
  .git {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--ui-divider);
    font-size: var(--ui-text-sm);
  }

  .branch {
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 6px 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    box-shadow: 0 0 0 1px var(--ui-divider);
    color: inherit;
    font: inherit;
    resize: vertical;
  }

  .scope {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .scope label {
    display: flex;
    align-items: center;
    gap: 6px;
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
    flex-wrap: wrap;
    gap: 6px;
  }

  button {
    padding: 4px 10px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    box-shadow: 0 0 0 1px var(--ui-divider);
    color: var(--ui-text);
    font: inherit;
    cursor: pointer;
  }

  button.primary {
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
  }

  button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .notice {
    margin: 0;
    color: var(--ui-text-2);
  }

  .notice.bad {
    color: #ff453a;
  }
</style>
