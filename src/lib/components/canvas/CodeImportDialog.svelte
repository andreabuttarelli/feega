<script lang="ts">
  import { onMount } from 'svelte';
  import { env as publicEnv } from '$env/dynamic/public';
  import { isLocalMode } from '$lib/local-user';
  import { canPickDirectory, listedFolder, pickDirectory } from '$lib/code-upload/pick-folder';
  import { SNAPSHOT_MESSAGES, type Snapshot } from '$lib/code-upload/snapshot';
  import CodeImportSignIn from './CodeImportSignIn.svelte';
  import { githubBranches, githubConnect, githubDisconnect, githubRepos, githubStatus, importCode, repoLink, routesListed, tokensFound, uploadFolder, type CodeLanded, type CodeTarget, type RenderCondition, type GithubRepo, type GithubStatus } from '$lib/canvas/code-import-client';
  import { checkedCount, matching, picked as pickedRoutes, picksOf, PickProblem, problemOf, type Pick } from '$lib/canvas/route-picks';

  let { projectId, canvasId, at, onimported, onclose }: { projectId: string; canvasId: string; at: { x: number; y: number }; onimported: (landed: CodeLanded) => void; onclose: () => void } = $props();

  const Source = { Repo: 'repo', Folder: 'folder', Upload: 'upload', Storybook: 'storybook' } as const;
  const localMode = isLocalMode(publicEnv);
  type Source = (typeof Source)[keyof typeof Source];

  const REFUSALS: Record<string, string> = {
    invalid: 'Enter a GitHub repository link and up to 20 page paths starting with /, or a Storybook link.',
    no_sandbox: 'Code import is not available right now.',
    run_failed: 'The app could not be started. A private repository needs GitHub connected.',
    no_browser: 'Code import is not available right now.',
    failed: 'The page could not be opened.',
    unreadable: 'Nothing on that page could be read.',
    rate_limited: 'Two imports every ten minutes. Try again shortly.',
    sign_in_needed: 'Every page asked for went to a sign-in page. Add a TEST account in project settings, or check it.',
    choose_app: 'This repository holds several apps. Pick one and import again.'
  };
  const FALLBACK_REFUSAL = 'Could not import that app.';
  const LISTING_NOTES: Record<string, string> = {
    no_router: 'No file router found: type the pages.',
    routes_in_code: 'Routes are defined in code: type the pages.',
    choose_app: 'Pick an app to list its pages.'
  };
  const LISTING_FALLBACK = 'Pages could not be listed: type them.';
  const PROBLEMS: Record<PickProblem, (path: string | null, max: number) => string> = {
    [PickProblem.NoneChecked]: () => 'Tick at least one page.',
    [PickProblem.OverCap]: (_, max) => `At most ${max} pages per import.`,
    [PickProblem.NeedsValue]: (path) => `${path} needs a value: type a path that fits it.`
  };
  const HTTP = /^https?:\/\//i;

  let source = $state<Source>(Source.Repo);
  let repo = $state('');
  let routes = $state('/');
  let storybook = $state('');
  let folder = $state('');
  let uploaded = $state<{ path: string; name: string; withheld: string[] } | null>(null);
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
  let apps = $state<string[]>([]);
  let app = $state('');
  let rows = $state<Pick[]>([]);
  let max = $state(0);
  let query = $state('');
  let listing = $state(false);
  let listNote = $state<string | null>(null);

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

  const LOOKUP_DELAY_MS = 400;
  let waitMs = $state('');
  let routeWaits = $state<Record<string, string>>({});
  const routeList = $derived(rows.length ? pickedRoutes(rows) : routes.split(/[\s,]+/).filter(Boolean));
  const msOf = (raw: string | undefined) => (raw?.trim() && Number.isFinite(Number(raw)) ? Math.max(0, Math.round(Number(raw))) : undefined);
  const wait = $derived({
    captureDelayMs: msOf(waitMs),
    routeDelayMs: Object.fromEntries(routeList.flatMap((r) => (msOf(routeWaits[r]) === undefined ? [] : [[r, msOf(routeWaits[r])!]])))
  });
  let designSystem = $state(true);
  let designTouched = $state(false);
  let found = $state<number | null>(null);

  const lookup = $derived(source === Source.Repo && repo.trim() ? { repo: linked(repo) } : source === Source.Folder && folder.trim() ? { folder: folder.trim() } : source === Source.Upload && uploaded ? { upload: uploaded.path } : null);

  $effect(() => {
    void lookup;
    apps = [];
    app = '';
  });

  $effect(() => {
    const where = lookup;
    found = null;
    if (!where) {
      return;
    }
    const timer = setTimeout(async () => {
      const count = await tokensFound(projectId, where);
      if (lookup === where) {
        found = count;
        designSystem = designTouched ? designSystem : count > 0;
      }
    }, LOOKUP_DELAY_MS);
    return () => clearTimeout(timer);
  });


  $effect(() => {
    const where = lookup;
    const chosen = app;
    rows = [];
    listNote = null;
    query = '';
    if (!where) {
      return;
    }
    const timer = setTimeout(async () => {
      listing = true;
      const got = await routesListed(projectId, where, chosen).finally(() => (listing = false));
      if (lookup !== where || app !== chosen) {
        return;
      }
      if (got.ok) {
        rows = picksOf(got.value.routes);
        max = got.value.max;
        return;
      }
      listNote = LISTING_NOTES[got.error] ?? LISTING_FALLBACK;
      apps = got.apps ?? apps;
    }, LOOKUP_DELAY_MS);
    return () => clearTimeout(timer);
  });

  const shown = $derived(matching(rows, query));
  const problem = $derived(rows.length ? problemOf(rows, max) : null);

  function tickAll(checked: boolean) {
    const visible = new Set(shown.map((r) => r.path));
    rows = rows.map((r) => (visible.has(r.path) && (!checked || r.kind !== 'dynamic' || r.value.trim()) ? { ...r, checked } : r));
  }

  const TARGETS: Record<Source, () => CodeTarget> = {
    [Source.Repo]: () => ({ repo: linked(repo), routes: routeList, conditions, designSystem, ...wait }),
    [Source.Folder]: () => ({ folder: folder.trim(), routes: routeList, conditions, designSystem, ...wait }),
    [Source.Upload]: () => ({ upload: uploaded?.path ?? '', routes: routeList, conditions, designSystem, ...wait }),
    [Source.Storybook]: () => ({ storybook: linked(storybook) })
  };

  const READY: Record<Source, () => boolean> = { [Source.Repo]: () => Boolean(repo.trim()), [Source.Folder]: () => Boolean(folder.trim()), [Source.Upload]: () => uploaded !== null, [Source.Storybook]: () => Boolean(storybook.trim()) };
  const ready = $derived(READY[source]() && conditions.length > 0 && problem === null);

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
    uploaded = done.ok ? { path: done.value, name: snapshot.name, withheld: snapshot.withheld } : null;
    message = done.ok ? null : 'The folder could not be uploaded. Try again.';
  }

  async function bring() {
    busy = true;
    message = null;
    detail = null;
    const got = await importCode({ projectId, canvasId, target: { ...TARGETS[source](), ...(app ? { app } : {}) }, at });
    busy = false;
    if (!got.ok) {
      message = REFUSALS[got.error] ?? FALLBACK_REFUSAL;
      detail = got.detail ?? null;
      apps = got.apps ?? apps;
      app = app || (apps[0] ?? '');
      return;
    }
    onimported(got.landed);
    onclose();
  }
</script>

{#snippet pages(testid: string)}
  {#if rows.length}
    <fieldset class="ui-pages" data-testid="code-import-pages">
      <div class="ui-row">
        <input class="rounded-sm" type="search" placeholder="Search pages" aria-label="Search pages" bind:value={query} data-testid="code-import-pages-search" />
        <button type="button" class="ui-btn rounded-sm" onclick={() => tickAll(true)} data-testid="code-import-pages-all">All</button>
        <button type="button" class="ui-btn rounded-sm" onclick={() => tickAll(false)} data-testid="code-import-pages-none">None</button>
      </div>
      <ul class="ui-page-list">
        {#each shown as row (row.path)}
          <li>
            <label title={row.file}>
              <input type="checkbox" bind:checked={rows[rows.indexOf(row)].checked} data-testid="code-import-page" data-path={row.path} />
              <span class="ui-path">{row.path}</span>
            </label>
            {#if row.kind === 'dynamic'}
              <input class="rounded-sm ui-value" type="text" list={`code-import-values-${row.path}`} placeholder={`needs a value, e.g. ${row.candidates[0]?.path ?? row.path}`} aria-label={`Path for ${row.path}`} bind:value={rows[rows.indexOf(row)].value} oninput={() => (rows[rows.indexOf(row)].checked = true)} data-testid="code-import-page-value" />
              <datalist id={`code-import-values-${row.path}`}>
                {#each row.candidates as c (c.path)}
                  <option value={c.path}>{c.from === 'code' ? 'from the code' : 'from a link'}</option>
                {/each}
              </datalist>
            {/if}
          </li>
        {/each}
      </ul>
      <p class="ui-note" data-testid="code-import-pages-count">{checkedCount(rows)} of {max} pages{problem ? ` · ${PROBLEMS[problem.problem](problem.path, max)}` : ''}</p>
    </fieldset>
  {:else}
    <input class="rounded-sm" type="text" placeholder="/  /settings  /users" aria-label="Pages" bind:value={routes} data-testid={testid} />
    {#if listing}<p class="ui-note" data-testid="code-import-pages-note">Listing pages…</p>{:else if listNote}<p class="ui-note" data-testid="code-import-pages-note">{listNote}</p>{/if}
  {/if}
{/snippet}

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
        {@render pages('code-import-route')}
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
        {@render pages('code-import-folder-route')}
      {:else if source === Source.Upload}
        <p class="ui-note">A project folder on this computer is uploaded once and runs in a sandbox, like a GitHub repo. Imported once, no sync: edits stay on the canvas. node_modules, build output and what .gitignore leaves out are skipped.</p>
        <div class="ui-row">
          <button type="button" class="ui-btn rounded-sm" disabled={uploading || busy} onclick={pickUpload} data-testid="code-import-pick-folder">{uploading ? 'Uploading…' : uploaded ? 'Pick another folder' : 'Pick folder'}</button>
          {#if uploaded}<span class="ui-note" data-testid="code-import-uploaded">{uploaded.name}{uploaded.withheld.length ? ` · ${uploaded.withheld.length} files withheld: ${uploaded.withheld.join(', ')}` : ''}</span>{/if}
        </div>
        <input bind:this={folderInput} class="sr-only" type="file" webkitdirectory tabindex="-1" aria-hidden="true" onchange={async (e) => upload(await listedFolder(e.currentTarget.files))} />
        {@render pages('code-import-upload-route')}
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
          <p class="ui-note">Each page lands once per theme and width, side by side. Language, flags and loading or error states are not switched.</p>
        </fieldset>
        <fieldset class="ui-conditions" data-testid="code-import-wait">
          <legend>Extra wait before capture (ms)</legend>
          <input class="rounded-sm" type="number" min="0" step="100" placeholder="0" aria-label="Extra wait for every page" bind:value={waitMs} data-testid="code-import-wait-all" />
          {#each routeList as r (r)}
            <label>{r} <input class="rounded-sm" type="number" min="0" step="100" placeholder={waitMs || '0'} aria-label={`Extra wait for ${r}`} bind:value={routeWaits[r]} data-testid="code-import-wait-route" /></label>
          {/each}
          <p class="ui-note">Pages already wait for the page to stop changing. Add time only for content that arrives late, such as a table of contents after a fetch.</p>
        </fieldset>
        {#if !localMode}
          <CodeImportSignIn {projectId} />
        {/if}
        {#if lookup}
        <fieldset class="ui-conditions" data-testid="code-import-design">
          <label><input type="checkbox" bind:checked={designSystem} onchange={() => (designTouched = true)} data-testid="code-import-design-system" /> Design system</label>
          <p class="ui-note" data-testid="code-import-design-count">
            {#if found === null}
              Looks for CSS tokens: @theme, :root, .dark.
            {:else if found > 0}
              {found} tokens found. They become variables with Light and Dark modes, bound to the layers, and a Design system board.
            {:else}
              No CSS tokens found in this project.
            {/if}
          </p>
        </fieldset>
        {/if}
      {/if}
      {#if apps.length > 1}
        <select class="rounded-sm" aria-label="App" bind:value={app} data-testid="code-import-app">
          {#each apps as a (a)}
            <option value={a}>{a}</option>
          {/each}
        </select>
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
  .ui-pages { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; border: 0; min-width: 0; }
  .ui-pages .ui-btn { font-size: 12.5px; font-weight: 500; padding: 4px 10px; }
  .ui-page-list { list-style: none; margin: 0; padding: 0; max-height: 220px; overflow: auto; border: 1px solid var(--line, #e3e3e6); }
  .ui-page-list li { display: flex; align-items: center; gap: 8px; padding: 4px 8px; font-size: 13px; }
  .ui-page-list label { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1; }
  .ui-page-list .ui-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, monospace; font-size: 12px; }
  .ui-page-list input[type='checkbox'] { flex: none; }
  .ui-form .ui-value { flex: 1; font-size: 12px; padding: 3px 6px; }
  .ui-note { margin: 0; font-size: 13px; color: var(--ink-soft, #6e6e73); }
  .ui-github { font-size: 12px; }
  .ui-link { font: inherit; padding: 0; border: 0; background: none; color: var(--ink, #1d1d1f); text-decoration: underline; cursor: pointer; }
  .ui-detail { margin: 0; font-size: 11px; max-height: 120px; overflow: auto; padding: 8px; background: var(--paper-soft, #f5f5f7); white-space: pre-wrap; }
  .ui-btn { font: inherit; font-size: 13.5px; font-weight: 600; padding: 8px 14px; cursor: pointer; border: 1px solid var(--line, #e3e3e6); }
  .ui-btn.primary { background: var(--ink, #1d1d1f); color: var(--paper, #fff); }
  .ui-btn:disabled { opacity: 0.5; cursor: default; }
</style>
