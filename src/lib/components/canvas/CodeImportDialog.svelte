<script lang="ts">
  import { onMount } from 'svelte';
  import { env as publicEnv } from '$env/dynamic/public';
  import { isLocalMode } from '$lib/local-user';
  import { canPickDirectory, listedFolder, pickDirectory } from '$lib/code-upload/pick-folder';
  import { SNAPSHOT_MESSAGES, type Snapshot } from '$lib/code-upload/snapshot';
  import { githubBranches, githubConnect, githubDisconnect, githubRepos, githubStatus, importCode, repoLink, uploadFolder, type CodeLanded, type CodeTarget, type RenderCondition, type GithubRepo, type GithubStatus } from '$lib/canvas/code-import-client';

  let { projectId, canvasId, at, onimported, onclose }: { projectId: string; canvasId: string; at: { x: number; y: number }; onimported: (landed: CodeLanded) => void; onclose: () => void } = $props();

  const Source = { Repo: 'repo', Folder: 'folder', Upload: 'upload', Storybook: 'storybook' } as const;
  const localMode = isLocalMode(publicEnv);
  type Source = (typeof Source)[keyof typeof Source];

  const REFUSALS: Record<string, string> = {
    invalid: 'Enter a GitHub repository link and up to 8 page paths starting with /, or a Storybook link.',
    no_sandbox: 'Code import is not available right now.',
    run_failed: 'The app could not be started. A private repository needs GitHub connected.',
    no_browser: 'Code import is not available right now.',
    failed: 'The page could not be opened.',
    unreadable: 'Nothing on that page could be read.',
    rate_limited: 'Two imports every ten minutes. Try again shortly.'
  };
  const FALLBACK_REFUSAL = 'Could not import that app.';
  const HTTP = /^https?:\/\//i;

  let source = $state<Source>(Source.Repo);
  let repo = $state('');
  let routes = $state('/');
  let storybook = $state('');
  let folder = $state('');
  let uploaded = $state<{ path: string; name: string } | null>(null);
  let uploading = $state(false);
  let folderInput = $state<HTMLInputElement | null>(null);
  let busy = $state(false);
  let message = $state<string | null>(null);
  let detail = $state<string | null>(null);
  let github = $state<GithubStatus | null>(null);
  let repos = $state<GithubRepo[]>([]);
  let picked = $state('');
  let branches = $state<string[]>([]);
  let branch = $state('');

  const SCHEMES = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' }
  ] as const;
  const WIDTHS = [
    { id: 1280, label: 'Desktop 1280' },
    { id: 768, label: 'Tablet 768' },
    { id: 390, label: 'Phone 390' }
  ] as const;
  let schemes = $state<string[]>(['light']);
  let widths = $state<number[]>([1280]);

  const conditions = $derived(
    schemes.flatMap((scheme) => widths.map((width) => ({ scheme: scheme as RenderCondition['scheme'], width })))
  );

  const linked = (raw: string) => (HTTP.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);

  const TARGETS: Record<Source, () => CodeTarget> = {
    [Source.Repo]: () => ({ repo: linked(repo), routes: routes.split(/[\s,]+/).filter(Boolean), conditions }),
    [Source.Folder]: () => ({ folder: folder.trim(), routes: routes.split(/[\s,]+/).filter(Boolean), conditions }),
    [Source.Upload]: () => ({ upload: uploaded?.path ?? '', routes: routes.split(/[\s,]+/).filter(Boolean), conditions }),
    [Source.Storybook]: () => ({ storybook: linked(storybook) })
  };

  const READY: Record<Source, () => boolean> = { [Source.Repo]: () => Boolean(repo.trim()), [Source.Folder]: () => Boolean(folder.trim()), [Source.Upload]: () => uploaded !== null, [Source.Storybook]: () => Boolean(storybook.trim()) };
  const ready = $derived(READY[source]() && conditions.length > 0);

  async function refresh() {
    const status = await githubStatus(projectId);
    github = status.ok ? status.value : null;
    if (!github?.connected) {
      return;
    }
    const listed = await githubRepos(projectId);
    repos = listed.ok ? listed.value.repos : [];
  }

  async function connect() {
    const started = await githubConnect(projectId, location.pathname);
    if (started.ok) {
      window.open(started.value.url, '_blank', 'noopener');
    }
  }

  async function disconnect() {
    await githubDisconnect(projectId);
    repos = [];
    await refresh();
  }

  async function pick() {
    const chosen = repos.find((r) => r.fullName === picked);
    branches = [];
    branch = chosen?.branch ?? '';
    repo = chosen ? repoLink(chosen.fullName, null) : repo;
    if (!chosen) {
      return;
    }
    const listed = await githubBranches(projectId, chosen.fullName);
    branches = listed.ok ? listed.value.branches : [];
  }

  $effect(() => {
    if (picked && branch) {
      repo = repoLink(picked, branch);
    }
  });

  onMount(() => {
    void refresh();
    const again = () => void refresh();
    window.addEventListener('focus', again);
    return () => window.removeEventListener('focus', again);
  });

  async function pickUpload() {
    message = null;
    if (!canPickDirectory()) {
      folderInput?.click();
      return;
    }
    await upload(await pickDirectory());
  }

  async function upload(snapshot: Snapshot | null) {
    if (!snapshot) {
      return;
    }
    if (!snapshot.ok) {
      message = SNAPSHOT_MESSAGES[snapshot.refusal];
      return;
    }
    uploading = true;
    const done = await uploadFolder(projectId, snapshot.name, snapshot.archive).finally(() => (uploading = false));
    uploaded = done.ok ? { path: done.value, name: snapshot.name } : null;
    message = done.ok ? null : 'The folder could not be uploaded. Try again.';
  }

  async function bring() {
    busy = true;
    message = null;
    detail = null;
    const got = await importCode({ projectId, canvasId, target: TARGETS[source](), at });
    busy = false;
    if (!got.ok) {
      message = REFUSALS[got.error] ?? FALLBACK_REFUSAL;
      detail = got.detail ?? null;
      return;
    }
    onimported(got.landed);
    onclose();
  }
</script>

<div class="ui-overlay" role="button" tabindex="-1" aria-label="Cancel" onclick={(e) => e.target === e.currentTarget && !busy && onclose()} onkeydown={(e) => e.key === 'Escape' && !busy && onclose()}>
  <div class="ui-card rounded-lg" role="dialog" aria-modal="true" aria-label="Import from code" data-testid="code-import-dialog">
    <h3>Import from code</h3>
    <div class="ui-tabs rounded-sm" role="tablist">
      <button class="rounded-sm" role="tab" aria-selected={source === Source.Repo} onclick={() => (source = Source.Repo)} data-testid="code-import-tab-repo">GitHub</button>
      {#if localMode}<button class="rounded-sm" role="tab" aria-selected={source === Source.Folder} onclick={() => (source = Source.Folder)} data-testid="code-import-tab-folder">Folder</button>{:else}<button class="rounded-sm" role="tab" aria-selected={source === Source.Upload} onclick={() => (source = Source.Upload)} data-testid="code-import-tab-upload">Folder</button>{/if}
      <button class="rounded-sm" role="tab" aria-selected={source === Source.Storybook} onclick={() => (source = Source.Storybook)} data-testid="code-import-tab-storybook">Storybook</button>
    </div>
    <form
      class="ui-form"
      onsubmit={(e) => {
        e.preventDefault();
        void bring();
      }}
    >
      {#if source === Source.Repo}
        <p class="ui-note">A React, Vue or Svelte app runs in a sandbox. Its components become main components, their props variants. Several pages, separated by spaces, land as boards of one frame sharing the components.</p>
        {#if github?.connected}
          <div class="ui-row">
            <select class="rounded-sm" aria-label="Your repositories" bind:value={picked} onchange={pick} data-testid="code-import-repos">
              <option value="">Your repositories…</option>
              {#each repos as r (r.fullName)}
                <option value={r.fullName}>{r.fullName}{r.private ? ' · private' : ''}</option>
              {/each}
            </select>
            {#if branches.length}
              <select class="rounded-sm" aria-label="Branch" bind:value={branch} data-testid="code-import-branch">
                {#each branches as b (b)}
                  <option value={b}>{b}</option>
                {/each}
              </select>
            {/if}
          </div>
        {/if}
        <input class="rounded-sm" type="text" inputmode="url" placeholder="https://github.com/owner/repo" aria-label="Repository" bind:value={repo} data-testid="code-import-repo" />
        <input class="rounded-sm" type="text" placeholder="/  /settings  /users" aria-label="Pages" bind:value={routes} data-testid="code-import-route" />
        <p class="ui-note ui-github" data-testid="code-import-github">
          {#if github?.connected}
            GitHub connected{github.label ? ` as ${github.label}` : ''}. <button type="button" class="ui-link" onclick={disconnect}>Disconnect</button>
          {:else if github?.configured}
            Private repository? <button type="button" class="ui-link" onclick={connect} data-testid="code-import-connect">Connect GitHub</button>
          {:else if github}
            Private repositories need GitHub, which is not set up here yet.
          {/if}
        </p>
      {:else if source === Source.Folder}
        <p class="ui-note">A project folder on this computer: its dev server runs here, edits on the canvas are written back to its files, and changes to the files show up on the canvas.</p>
        <input class="rounded-sm" type="text" placeholder="/Users/you/code/my-app" aria-label="Folder" bind:value={folder} data-testid="code-import-folder" />
        <input class="rounded-sm" type="text" placeholder="/  /settings  /users" aria-label="Pages" bind:value={routes} data-testid="code-import-folder-route" />
      {:else if source === Source.Upload}
        <p class="ui-note">A project folder on this computer is uploaded once and runs in a sandbox, like a GitHub repo. Imported once, no sync: edits stay on the canvas. node_modules, build output and what .gitignore leaves out are skipped.</p>
        <div class="ui-row">
          <button type="button" class="ui-btn rounded-sm" disabled={uploading || busy} onclick={pickUpload} data-testid="code-import-pick-folder">{uploading ? 'Uploading…' : uploaded ? 'Pick another folder' : 'Pick folder'}</button>
          {#if uploaded}<span class="ui-note" data-testid="code-import-uploaded">{uploaded.name}</span>{/if}
        </div>
        <input bind:this={folderInput} class="sr-only" type="file" webkitdirectory tabindex="-1" aria-hidden="true" onchange={async (e) => upload(await listedFolder(e.currentTarget.files))} />
        <input class="rounded-sm" type="text" placeholder="/  /settings  /users" aria-label="Pages" bind:value={routes} data-testid="code-import-upload-route" />
      {:else}
        <p class="ui-note">A public Storybook: each story is read without running the app, its components become main components, their args variants.</p>
        <input class="rounded-sm" type="text" inputmode="url" placeholder="https://storybook.example.com" aria-label="Storybook" bind:value={storybook} data-testid="code-import-storybook" />
      {/if}
      {#if source !== Source.Storybook}
        <fieldset class="ui-conditions" data-testid="code-import-conditions">
          <legend>Render under</legend>
          {#each SCHEMES as s (s.id)}
            <label><input type="checkbox" value={s.id} bind:group={schemes} data-testid={`code-import-scheme-${s.id}`} /> {s.label}</label>
          {/each}
          {#each WIDTHS as w (w.id)}
            <label><input type="checkbox" value={w.id} bind:group={widths} data-testid={`code-import-width-${w.id}`} /> {w.label}</label>
          {/each}
          <p class="ui-note">Each page lands once per theme and width, side by side. Language, login, flags and loading or error states are not switched.</p>
        </fieldset>
      {/if}
      <div class="ui-row ui-end">
        <button class="ui-btn primary rounded-sm" type="submit" disabled={busy || !ready} data-testid="code-import-run">{busy ? (source !== Source.Storybook ? 'Starting the app…' : 'Reading the stories…') : 'Import'}</button>
      </div>
    </form>
    {#if message}
      <p class="ui-note" role="alert" data-testid="code-import-message">{message}</p>
    {/if}
    {#if detail}
      <pre class="ui-detail rounded-sm">{detail}</pre>
    {/if}
  </div>
</div>

<style>
  .ui-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; padding: 24px; }
  .ui-card { background: var(--paper, #fff); padding: 22px; width: 100%; max-width: 480px; box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column; gap: 10px; }
  .ui-card h3 { margin: 0 0 2px; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
  .ui-tabs { display: flex; gap: 2px; padding: 2px; background: var(--paper-soft, #f5f5f7); align-self: flex-start; }
  .ui-tabs button { font: inherit; font-size: 12.5px; padding: 4px 10px; border: 0; background: transparent; color: var(--ink-soft, #6e6e73); cursor: pointer; }
  .ui-tabs button[aria-selected='true'] { background: var(--paper, #fff); color: var(--ink, #1d1d1f); }
  .ui-form { display: flex; flex-direction: column; gap: 8px; }
  .ui-row { display: flex; gap: 8px; }
  .ui-end { justify-content: flex-end; }
  .ui-form input, .ui-form select { flex: 1; min-width: 0; font: inherit; font-size: 13px; padding: 6px 8px; border: 1px solid var(--line, #e3e3e6); background: var(--paper, #fff); color: var(--ink, #1d1d1f); }
  .ui-conditions { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 0; padding: 0; border: 0; font-size: 13px; }
  .ui-conditions legend { padding: 0; margin-bottom: 4px; color: var(--ink-soft, #6e6e73); }
  .ui-conditions label { display: flex; align-items: center; gap: 4px; }
  .ui-conditions input { flex: none; padding: 0; }
  .ui-conditions .ui-note { flex-basis: 100%; }
  .ui-note { margin: 0; font-size: 13px; color: var(--ink-soft, #6e6e73); }
  .ui-github { font-size: 12px; }
  .ui-link { font: inherit; padding: 0; border: 0; background: none; color: var(--ink, #1d1d1f); text-decoration: underline; cursor: pointer; }
  .ui-detail { margin: 0; font-size: 11px; max-height: 120px; overflow: auto; padding: 8px; background: var(--paper-soft, #f5f5f7); white-space: pre-wrap; }
  .ui-btn { font: inherit; font-size: 13.5px; font-weight: 600; padding: 8px 14px; cursor: pointer; border: 1px solid var(--line, #e3e3e6); }
  .ui-btn.primary { background: var(--ink, #1d1d1f); color: var(--paper, #fff); }
  .ui-btn:disabled { opacity: 0.5; cursor: default; }
</style>
