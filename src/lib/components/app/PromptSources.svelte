<script lang="ts">
  import { onMount } from 'svelte';
  import { Connect, PROMPT_SOURCES, PROMPT_SOURCE_ORDER, PromptSource, sourceName, type SourcePick } from '$lib/home/prompt-sources';
  import { githubConnect, githubStatus } from '$lib/canvas/code-import-client';

  let { pick = $bindable(null), projectId = null, pickAgain = null }: { pick: SourcePick | null; projectId?: string | null; pickAgain?: PromptSource | null } = $props();

  let editing = $state<PromptSource | null>(null);
  let draft = $state('');
  let folderName = $state('');
  let githubConnected = $state(true);
  let folderInput = $state<HTMLInputElement | null>(null);

  onMount(() => {
    if (pickAgain) {
      editing = pickAgain;
    }
  });

  $effect(() => {
    if (pick?.source !== PromptSource.Github || !projectId) {
      return;
    }
    void githubStatus(projectId).then((status) => (githubConnected = !status.ok || status.value.connected || !status.value.configured));
  });

  type DirectoryWindow = Window & { showDirectoryPicker?: () => Promise<{ name: string }> };

  async function pickFolder() {
    const picker = (window as DirectoryWindow).showDirectoryPicker;
    if (!picker) {
      folderInput?.click();
      return;
    }
    const handle = await picker().catch(() => null);
    if (handle) {
      folderPicked(handle.name);
    }
  }

  function folderFromInput(e: Event) {
    const first = (e.currentTarget as HTMLInputElement).files?.[0];
    const name = first?.webkitRelativePath.split('/')[0];
    if (name) {
      folderPicked(name);
    }
  }

  function folderPicked(name: string) {
    folderName = name;
    editing = PromptSource.Folder;
    draft = '';
  }

  const START: Record<PromptSource, () => void> = {
    [PromptSource.Github]: () => open(PromptSource.Github),
    [PromptSource.Figma]: () => open(PromptSource.Figma),
    [PromptSource.Folder]: () => void pickFolder()
  };

  function open(source: PromptSource) {
    editing = source;
    draft = '';
  }

  function confirm() {
    if (!editing || !draft.trim()) {
      return;
    }
    pick = { source: editing, value: draft.trim() };
    editing = null;
  }

  function entryKey(e: KeyboardEvent) {
    if (e.key !== 'Enter') {
      return;
    }
    e.preventDefault();
    confirm();
  }

  async function connectGithub() {
    if (!projectId) {
      return;
    }
    const started = await githubConnect(projectId, location.pathname);
    if (started.ok) {
      location.href = started.value.url;
    }
  }

  const CONNECT_HREF: Record<Connect, (projectId: string) => string | null> = {
    [Connect.Github]: () => null,
    [Connect.Figma]: (id) => `/p/${id}/settings/profile`,
    [Connect.None]: () => null
  };
</script>

<div class="sources" data-testid="prompt-sources">
  {#each PROMPT_SOURCE_ORDER as source (source)}
    <button type="button" class="source" data-source={source} aria-pressed={pick?.source === source || editing === source} onclick={START[source]}>{PROMPT_SOURCES[source].label}</button>
  {/each}
  <input bind:this={folderInput} class="sr-only" type="file" webkitdirectory tabindex="-1" aria-hidden="true" onchange={folderFromInput} />
</div>

{#if editing}
  <div class="entry" data-testid="source-entry">
    {#if editing === PromptSource.Folder}
      <p class="note">
        {#if pickAgain === PromptSource.Folder && !folderName}A folder can't be kept through sign-in: pick it again.{:else}Browsers hide where <b>{folderName}</b> lives: paste its full path.{/if}
      </p>
    {/if}
    <input type="text" placeholder={editing === PromptSource.Folder && folderName ? `/Users/you/code/${folderName}` : PROMPT_SOURCES[editing].placeholder} aria-label={PROMPT_SOURCES[editing].label} bind:value={draft} onkeydown={entryKey} data-testid="source-value" />
    <button type="button" onclick={confirm} disabled={!draft.trim()}>add</button>
    <button type="button" onclick={() => (editing = null)} aria-label="Cancel">×</button>
  </div>
{/if}

{#if pick}
  <div class="chip" data-testid="source-chip" data-source={pick.source}>
    <span class="kind">{PROMPT_SOURCES[pick.source].label}</span>
    <span class="name">{sourceName(pick.source, pick.value)}</span>
    {#if pick.source === PromptSource.Github && projectId && !githubConnected}
      <button type="button" class="link" onclick={connectGithub}>connect GitHub</button>
    {/if}
    {#if projectId && CONNECT_HREF[PROMPT_SOURCES[pick.source].connect](projectId)}
      <a class="link" href={CONNECT_HREF[PROMPT_SOURCES[pick.source].connect](projectId)}>Figma token</a>
    {/if}
    <button type="button" aria-label="Remove source" onclick={() => (pick = null)}>×</button>
  </div>
{/if}

<style>
  .sources {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-1);
  }

  .source,
  .entry button,
  .chip button {
    height: var(--ui-row);
    padding: 0 var(--ui-space-2);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-secondary);
    font: inherit;
    font-size: var(--ui-type-label);
    cursor: pointer;
  }

  .source:hover,
  .source[aria-pressed='true'] {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .entry,
  .chip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ui-space-1);
    font-size: var(--ui-type-label);
  }

  .entry input {
    flex: 1 1 200px;
    height: var(--ui-row);
    padding: 0 var(--ui-space-2);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-type-label);
  }

  .note {
    flex-basis: 100%;
    margin: 0;
    color: var(--ui-text-secondary);
  }

  .chip {
    align-self: flex-start;
    padding: 0 0 0 var(--ui-space-2);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }

  .kind {
    color: var(--ui-text-tertiary);
  }

  .name {
    color: var(--ui-text);
  }

  .link {
    color: var(--ui-accent);
    text-decoration: underline;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
