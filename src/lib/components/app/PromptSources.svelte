<script lang="ts">
  import { onMount } from 'svelte';
  import { env as publicEnv } from '$env/dynamic/public';
  import { isLocalMode } from '$lib/local-user';
  import { AppMode, Connect, PROMPT_SOURCES, PromptSource, sourceName, sourcesFor, type SourcePick } from '$lib/home/prompt-sources';
  import { githubConnect, githubStatus, uploadFolder } from '$lib/canvas/code-import-client';
  import { canPickDirectory, listedFolder, pickDirectory } from '$lib/code-upload/pick-folder';
  import { SNAPSHOT_MESSAGES, type Snapshot } from '$lib/code-upload/snapshot';

  let { pick = $bindable(null), projectId = null, pickAgain = null }: { pick: SourcePick | null; projectId?: string | null; pickAgain?: PromptSource | null } = $props();

  let editing = $state<PromptSource | null>(null);
  let draft = $state('');
  let folderName = $state('');
  let githubConnected = $state(true);
  let folderInput = $state<HTMLInputElement | null>(null);
  let uploading = $state<string | null>(null);
  let uploadNote = $state<string | null>(null);

  const mode = isLocalMode(publicEnv) ? AppMode.Local : AppMode.Cloud;
  const order = sourcesFor(mode);
  const UPLOAD_FAILED = 'The folder could not be uploaded. Try again.';

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

  async function pickUpload() {
    uploadNote = null;
    if (!canPickDirectory()) {
      folderInput?.click();
      return;
    }
    await uploaded(await pickDirectory());
  }

  async function folderFromInput(e: Event) {
    const list = (e.currentTarget as HTMLInputElement).files;
    if (mode === AppMode.Cloud) {
      await uploaded(await listedFolder(list));
      return;
    }
    const name = list?.[0]?.webkitRelativePath.split('/')[0];
    if (name) {
      folderPicked(name);
    }
  }

  async function uploaded(snapshot: Snapshot | null) {
    if (!snapshot) {
      return;
    }
    if (!snapshot.ok) {
      uploadNote = SNAPSHOT_MESSAGES[snapshot.refusal];
      return;
    }
    if (!projectId) {
      pick = { source: PromptSource.Upload, value: snapshot.name };
      return;
    }
    uploading = snapshot.name;
    const done = await uploadFolder(projectId, snapshot.name, snapshot.archive).finally(() => (uploading = null));
    if (!done.ok) {
      uploadNote = UPLOAD_FAILED;
      return;
    }
    editing = null;
    pick = { source: PromptSource.Upload, value: done.value };
    uploadNote = snapshot.skipped.length ? `Left out ${snapshot.skipped.length} file${snapshot.skipped.length === 1 ? '' : 's'} over 1 MB.` : null;
  }

  function folderPicked(name: string) {
    folderName = name;
    editing = PromptSource.Folder;
    draft = '';
  }

  const START: Record<PromptSource, () => void> = {
    [PromptSource.Github]: () => open(PromptSource.Github),
    [PromptSource.Figma]: () => open(PromptSource.Figma),
    [PromptSource.Folder]: () => void pickFolder(),
    [PromptSource.Upload]: () => void pickUpload()
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
  {#each order as source (source)}
    <button type="button" class="source" data-source={source} aria-pressed={pick?.source === source || editing === source} onclick={START[source]}>{PROMPT_SOURCES[source].label}</button>
  {/each}
  <input bind:this={folderInput} class="sr-only" type="file" webkitdirectory tabindex="-1" aria-hidden="true" onchange={folderFromInput} />
</div>

{#if uploading}<p class="note" data-testid="upload-progress">Uploading {uploading}…</p>{/if}
{#if uploadNote}<p class="note" data-testid="upload-note">{uploadNote}</p>{/if}

{#if editing === PromptSource.Upload}
  <div class="entry" data-testid="source-entry">
    <p class="note">A folder can't be kept through sign-in: pick it again. It is imported once, with no sync back to your files.</p>
    <button type="button" onclick={pickUpload}>pick folder</button>
    <button type="button" onclick={() => (editing = null)} aria-label="Cancel">×</button>
  </div>
{:else if editing}
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
    {#if pick.source === PromptSource.Upload}<span class="kind" data-testid="source-once">imported once, no sync</span>{/if}
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
