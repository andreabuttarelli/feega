<script lang="ts">
  import Download from '@lucide/svelte/icons/download';
  import GitPullRequest from '@lucide/svelte/icons/git-pull-request';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import { repoChanges, repoHead, repoPull, repoPublish, type RepoChanges } from '$lib/canvas/code-import-client';
  import { Button } from '$lib/components/ui/button';
  import CodeBlock from './CodeBlock.svelte';

  let { projectId, nodeId, revision }: { projectId: string; nodeId: string; revision: unknown } = $props();

  const PATCH_MIME = 'text/x-diff';
  const RELOAD_MS = 800;
  const WATCH_MS = 3_000;
  type KindRow = { title: string; publish: string | null; syncs: boolean; name: (repo: string) => string };
  const lastPart = (repo: string) => repo.split('/').at(-1) ?? repo;
  const KINDS: Record<RepoChanges['kind'], KindRow> = {
    github: { title: 'GitHub', publish: 'Open pull request', syncs: true, name: (repo) => repo },
    folder: { title: 'Folder', publish: 'Write to folder', syncs: true, name: (repo) => repo },
    upload: { title: 'Folder', publish: null, syncs: false, name: lastPart }
  };
  const REFUSALS: Record<string, string> = {
    no_changes: 'Nothing to send: no edit maps to the code yet.',
    no_github: 'Connect GitHub to open a pull request. You can still download the patch.',
    publish_failed: 'The files could not be written.',
    unreachable: 'The repository could not be reached.',
    conflict: 'The frame changed while pulling. Try again.'
  };

  let changes = $state<RepoChanges | null>(null);
  const kind = $derived(KINDS[changes?.kind ?? 'github']);
  let fromCode = $state(true);
  let busy = $state(false);
  let branch = $state('');
  let note = $state<string | null>(null);
  let link = $state<string | null>(null);

  async function load() {
    const got = await repoChanges(projectId, nodeId);
    fromCode = got.ok || got.error !== 'not_from_code';
    changes = got.ok ? got.value : null;
  }

  $effect(() => {
    void revision;
    const later = setTimeout(() => void load(), RELOAD_MS);
    return () => clearTimeout(later);
  });

  function download() {
    if (!changes?.patch) {
      return;
    }
    const url = URL.createObjectURL(new Blob([changes.patch], { type: PATCH_MIME }));
    Object.assign(document.createElement('a'), { href: url, download: `${lastPart(changes.repo)}-feega.patch` }).click();
    URL.revokeObjectURL(url);
  }

  async function run(action: () => Promise<void>) {
    busy = true;
    note = null;
    link = null;
    await action().finally(() => (busy = false));
  }

  const publish = () =>
    run(async () => {
      const done = await repoPublish(projectId, nodeId);
      if (!done.ok) {
        note = REFUSALS[done.error] ?? 'Could not send the edits.';
        return;
      }
      const { url, branch: on, files } = done.value;
      note = url ? `Pull request opened on ${on}.` : `Wrote ${files.join(', ')}${on ? `, committed on ${on}` : ''}.`;
      link = url;
      await load();
    });

  $effect(() => {
    if (changes?.kind !== 'folder') {
      return;
    }
    const timer = setInterval(async () => {
      const head = await repoHead(projectId, nodeId);
      if (!busy && head.ok && head.value.head && head.value.head !== head.value.sha) {
        await pull();
      }
    }, WATCH_MS);
    return () => clearInterval(timer);
  });

  const pull = () =>
    run(async () => {
      const done = await repoPull(projectId, nodeId, branch.trim());
      if (!done.ok) {
        note = REFUSALS[done.error] ?? 'Could not pull from GitHub.';
        return;
      }
      const { outcome, sha, carried, conflicts, tokens = [] } = done.value;
      note = outcome === 'up_to_date' ? `Already at ${sha.slice(0, 7)}.` : `Pulled ${sha.slice(0, 7)}, ${carried} edit${carried === 1 ? '' : 's'} kept.${tokens.length ? ` Tokens: ${tokens.join('; ')}.` : ''}${conflicts.length ? ` ${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'}: ${conflicts.join('; ')}` : ''}`;
      await load();
    });
</script>

{#if fromCode}
  <section class="sync" data-testid="repo-sync" aria-label="Code sync">
    <header>
      <strong>{kind.title}</strong>
      {#if changes}<span class="repo" title={changes.sha}>{kind.name(changes.repo)}{#if kind.syncs}@{changes.sha.slice(0, 7)}{/if}</span>{/if}
    </header>

    {#if changes}
      <p class="count" data-testid="repo-sync-count">{changes.files.length ? `${changes.files.length} file${changes.files.length === 1 ? '' : 's'} changed: ${changes.files.join(', ')}` : 'No edits to send yet.'}</p>
      {#if changes.skipped.length}
        <ul class="skipped" data-testid="repo-sync-skipped">
          {#each changes.skipped as line (line)}<li>{line}</li>{/each}
        </ul>
      {/if}
      {#if changes.patch}<CodeBlock code={changes.patch} label="Copy patch" testid="repo-sync-patch" copytestid="repo-sync-copy" />{/if}
      <div class="actions">
        <Button size="sm" variant="secondary" disabled={!changes.patch} onclick={download} data-testid="repo-sync-download"><Download size={14} /> Patch</Button>
        {#if kind.publish}<Button size="sm" disabled={busy || !changes.patch} onclick={publish} data-testid="repo-sync-publish"><GitPullRequest size={14} /> {kind.publish}</Button>{/if}
      </div>
    {/if}

    {#if !kind.syncs}<p class="note" data-testid="repo-sync-once">Imported once, no sync: edits stay on the canvas. Download the patch to apply them to your files.</p>{/if}

    {#if kind.syncs}<div class="actions">
      <input class="branch" placeholder="branch (default: imported)" bind:value={branch} aria-label="Branch to pull" data-testid="repo-sync-branch" />
      <Button size="sm" variant="secondary" disabled={busy} onclick={pull} data-testid="repo-sync-pull"><RefreshCw size={14} /> Pull</Button>
    </div>{/if}

    {#if note}<p class="note" data-testid="repo-sync-note">{note}{#if link} <a href={link} target="_blank" rel="noopener">{link}</a>{/if}</p>{/if}
  </section>
{/if}

<style>
  .sync {
    display: grid;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid var(--ui-border);
    font-size: var(--ui-text-caption, 12px);
  }
  header {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .repo,
  .count,
  .skipped {
    color: var(--ui-text-muted);
  }
  .skipped {
    margin: 0;
    padding-left: 16px;
  }
  .actions {
    display: flex;
    gap: 6px;
  }
  .branch {
    flex: 1;
    min-width: 0;
    padding: 4px 6px;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: inherit;
  }
  .note {
    margin: 0;
    word-break: break-word;
  }
</style>
