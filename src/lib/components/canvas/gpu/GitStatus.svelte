<script lang="ts">
  import GitBranch from '@lucide/svelte/icons/git-branch';
  import GitPullRequestDraft from '@lucide/svelte/icons/git-pull-request-draft';
  import GitPullRequest from '@lucide/svelte/icons/git-pull-request';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import History from '@lucide/svelte/icons/history';
  import CloudCheck from '@lucide/svelte/icons/cloud-check';
  import Cloud from '@lucide/svelte/icons/cloud';
  import CloudOff from '@lucide/svelte/icons/cloud-off';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import type { Component } from 'svelte';
  import Hint from '$lib/components/ui/shell/Hint.svelte';
  import { Side } from '$lib/components/ui/shell/styles';
  import { Button } from '$lib/components/ui/button';
  import { AutosaveState } from '$lib/canvas/code-autosave';
  import type { GitSummary } from '$lib/canvas/git-status';
  import { CiState } from '$lib/canvas/source-changes';

  let { summary, open = false, onchanges, onversions, onready, onupstream }: { summary: GitSummary; open?: boolean; onchanges: () => void; onversions: (nodeId: string) => void; onready: (nodeId: string) => void; onupstream: (nodeId: string) => void } = $props();

  type Look = { icon: Component; label: string; tone: string; spin?: boolean };
  const AUTOSAVE: Record<AutosaveState, Look> = {
    [AutosaveState.Idle]: { icon: CloudCheck, label: 'Up to date', tone: 'muted' },
    [AutosaveState.Pending]: { icon: Cloud, label: 'Unsaved edits, saving soon', tone: 'muted' },
    [AutosaveState.Saving]: { icon: LoaderCircle, label: 'Saving to GitHub…', tone: 'muted', spin: true },
    [AutosaveState.Saved]: { icon: CloudCheck, label: 'All edits committed', tone: 'muted' },
    [AutosaveState.Conflict]: { icon: TriangleAlert, label: 'Conflict: autosave stopped. Open to resolve', tone: 'warn' },
    [AutosaveState.Paused]: { icon: TriangleAlert, label: 'Autosave paused: needs a confirmation', tone: 'warn' },
    [AutosaveState.Failed]: { icon: CloudOff, label: 'Not saved: GitHub could not be reached', tone: 'danger' }
  };
  const CI_LABEL: Record<CiState, string> = { [CiState.None]: 'No checks', [CiState.Running]: 'CI running', [CiState.Passed]: 'CI passed', [CiState.Failed]: 'CI failed' };

  const repoName = $derived(summary.repo.split('/').at(-1) ?? summary.repo);
  const save = $derived(AUTOSAVE[summary.autosave]);
</script>

<div class="git" data-testid="git-status">
  <button type="button" class="chip" aria-expanded={open} onclick={onchanges} data-testid="git-branch">
    <GitBranch size={14} />
    <span class="repo">{repoName}</span>
    <span class="sep">/</span>
    <span class="branch">{summary.branch}</span>
    <ChevronDown size={12} />
  </button>

  <Hint label={save.label} side={Side.Bottom}>
    {#snippet children(props)}
      <span {...props} class="save tone-{save.tone}" class:spin={save.spin} role="status" aria-label={save.label} data-testid="git-autosave" data-state={summary.autosave}><save.icon size={14} /></span>
    {/snippet}
  </Hint>

  {#if summary.upstream}
    <Hint label="Pull the changes from {summary.base} into the frame" side={Side.Bottom}>
      {#snippet children(props)}
        <button {...props} type="button" class="pill" onclick={() => onupstream(summary.nodeId)} data-testid="git-upstream"><ArrowDown size={12} />{summary.upstream} new upstream</button>
      {/snippet}
    </Hint>
  {/if}

  {#if summary.pull}
    <Hint label="{summary.draft ? 'Draft pull request' : 'Pull request'} · {CI_LABEL[summary.ci]}" side={Side.Bottom}>
      {#snippet children(props)}
        <a {...props} class="chip" href={summary.pull!.url} target="_blank" rel="noopener" data-testid="git-pull">
          {#if summary.draft}<GitPullRequestDraft size={14} />{:else}<GitPullRequest size={14} />{/if}
          #{summary.pull!.number}{#if summary.draft}<span class="muted">Draft</span>{/if}
          {#if summary.ci !== CiState.None}<span class="ci ci-{summary.ci}"></span>{/if}
        </a>
      {/snippet}
    </Hint>
  {/if}

  <Hint label="Versions and compare" side={Side.Bottom}>
    {#snippet children(props)}
      <button {...props} type="button" class="icon" aria-label="Versions" onclick={() => onversions(summary.nodeId)} data-testid="git-versions"><History size={14} /></button>
    {/snippet}
  </Hint>

  {#if summary.draft}
    <Button size="sm" onclick={() => onready(summary.nodeId)} data-testid="git-ready">Ready for review</Button>
  {/if}
</div>

<style>
  .git {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-inline-end: 4px;
    padding-inline-end: 6px;
    border-inline-end: 1px solid var(--ui-divider, var(--ui-border));
  }
  .chip,
  .pill,
  .icon,
  .save {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-secondary);
    font-size: var(--ui-type-label);
    white-space: nowrap;
    text-decoration: none;
  }
  .chip,
  .pill,
  .icon {
    cursor: pointer;
  }
  .chip:hover,
  .icon:hover,
  .chip[aria-expanded='true'] {
    background: var(--ui-wash);
    color: var(--ui-text);
  }
  .icon,
  .save {
    padding: 0 6px;
  }
  .repo {
    color: var(--ui-text);
    font-weight: var(--ui-weight-medium);
  }
  .sep,
  .muted,
  .tone-muted {
    color: var(--ui-text-tertiary);
  }
  .branch {
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pill {
    height: 22px;
    margin: 0 2px;
    padding: 0 8px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-accent-wash);
    color: var(--ui-accent-text);
  }
  .tone-warn {
    color: var(--ui-warn);
  }
  .tone-danger {
    color: var(--ui-danger);
  }
  .spin :global(svg) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .ci {
    width: 6px;
    height: 6px;
    border-radius: var(--ui-radius-full);
  }
  .ci-passed {
    background: var(--ui-ok);
  }
  .ci-failed {
    background: var(--ui-danger);
  }
  .ci-running {
    background: var(--ui-warn);
  }
</style>
