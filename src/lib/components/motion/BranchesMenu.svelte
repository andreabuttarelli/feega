<script lang="ts">
  import { Side } from '$lib/motion/branch-merge';

  type Fork = { id: string; frameId: string; name: string; baseVersion: number };
  type Conflict = { path: string; branch: unknown; main: unknown };

  let {
    fork,
    branches,
    conflicts,
    oncreate,
    onopen,
    onreview,
    onmerge,
    ondrop
  }: {
    fork: Fork | null;
    branches: Fork[];
    conflicts: Conflict[] | null;
    oncreate: (name: string) => void;
    onopen: (id: string) => void;
    onreview: () => void;
    onmerge: (choices: Record<string, Side>) => void;
    ondrop: () => void;
  } = $props();

  let choices = $state<Record<string, Side>>({});

  const shown = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value));
</script>

<div class="menu" role="menu" data-testid="branches">
  {#if fork}
    <span class="title">Branch “{fork.name}” of version {fork.baseVersion}</span>
    {#if conflicts === null}
      <button type="button" role="menuitem" data-testid="branch-review" onclick={onreview}>Review and merge</button>
    {:else}
      {#each conflicts as c (c.path)}
        <div class="conflict" data-testid="branch-conflict" data-path={c.path}>
          <code>{c.path}</code>
          <label><input type="radio" name={c.path} checked={(choices[c.path] ?? Side.Main) === Side.Main} onchange={() => (choices = { ...choices, [c.path]: Side.Main })} /> Frame: {shown(c.main)}</label>
          <label><input type="radio" name={c.path} data-testid="keep-branch" checked={choices[c.path] === Side.Branch} onchange={() => (choices = { ...choices, [c.path]: Side.Branch })} /> Branch: {shown(c.branch)}</label>
        </div>
      {:else}
        <span class="empty">No conflicts</span>
      {/each}
      <button type="button" role="menuitem" data-testid="branch-merge" onclick={() => onmerge(choices)}>Merge into the frame</button>
    {/if}
    <button type="button" role="menuitem" data-testid="branch-drop" onclick={ondrop}>Drop this branch</button>
  {:else}
    <input class="version-name" aria-label="New branch name" placeholder="New branch name" data-testid="branch-name" onkeydown={(e) => e.key === 'Enter' && e.currentTarget.value.trim() && oncreate(e.currentTarget.value.trim())} />
    {#each branches as b (b.id)}
      <button type="button" role="menuitem" data-testid="branch-open" onclick={() => onopen(b.id)}><span>{b.name} · from v{b.baseVersion}</span><kbd>Open</kbd></button>
    {:else}
      <span class="empty">No branches</span>
    {/each}
  {/if}
</div>

<style>
  .menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 20;
    display: grid;
    grid-template-columns: 260px;
    gap: 4px;
    max-height: calc(100vh - 120px);
    overflow: auto;
    padding: 4px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
  }

  .menu button {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    text-align: left;
    min-height: var(--ui-row);
    padding: 0 8px;
    border-radius: var(--ui-radius-sm);
    font-size: var(--ui-type-body);
    color: var(--ui-text);
  }

  .menu button:hover,
  .menu button:focus-visible {
    background: var(--ui-wash);
    outline: none;
  }

  .menu kbd {
    margin-left: auto;
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    color: var(--ui-text-3);
  }

  .version-name {
    font: inherit;
    font-size: 12px;
    padding: 6px 8px;
    margin-bottom: 4px;
    border: 1px solid var(--ui-divider, #e3e3e6);
    background: transparent;
    color: inherit;
  }

  .empty { padding: 6px 10px; font-size: 12px; opacity: 0.6; }
  .title { display: block; padding: 6px 10px; font-size: 12px; opacity: 0.7; }
  .conflict { display: grid; gap: 4px; padding: 6px 10px; font-size: 12px; }
  .conflict code { opacity: 0.6; }
</style>
