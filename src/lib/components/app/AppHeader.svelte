<script lang="ts">
  import CreditAmount from '$lib/components/CreditAmount.svelte';
  import CanvasMenu from '$lib/components/canvas/CanvasMenu.svelte';
  import { pageMeta } from '$lib/stores/page-meta';

  let {
    menuProjectId,
    profile,
    org,
    workspaces,
    creditBalance
  }: {
    menuProjectId: string;
    profile: { name: string | null; email: string; avatarUrl: string | null };
    org: { id: string; name: string };
    workspaces: { id: string; name: string }[];
    creditBalance: number;
  } = $props();

  const title = $derived($pageMeta.title);
</script>

<header class="app-header" data-testid="app-header">
  <CanvasMenu projectId={menuProjectId} {profile} {org} {creditBalance} navigation="page" />
  <a class="home" href="/app" aria-label="Dashboard">
    <span class="word">feega</span>
  </a>
  {#if title}
    <span class="slash" aria-hidden="true">/</span>
    <span class="title">{title}</span>
  {/if}

  <span class="spacer"></span>

  {#if workspaces.length > 1}
    <form method="POST" action="/app?/workspace" class="workspace">
      <label class="sr-only" for="workspace-select">Workspace</label>
      <select id="workspace-select" name="orgId" value={org.id} onchange={(e) => e.currentTarget.form?.requestSubmit()}>
        {#each workspaces as w (w.id)}
          <option value={w.id}>{w.name}</option>
        {/each}
      </select>
    </form>
  {:else}
    <span class="org">{org.name}</span>
  {/if}

  <a class="credits" href="/p/{menuProjectId}/settings/billing">
    <CreditAmount amount={creditBalance} />
  </a>
</header>

<style>
  .app-header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--shell-top-h);
    padding: 0 16px 0 8px;
    border-bottom: 1px solid var(--ui-line);
    background: var(--ui-bg);
  }

  .home {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 6px;
    color: var(--ui-ink);
    text-decoration: none;
  }

  .word {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .slash {
    color: var(--ui-line-strong);
  }

  .title {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 14px;
    font-weight: 600;
    color: var(--ui-ink);
  }

  .spacer {
    flex: 1 1 auto;
  }

  .org {
    font-size: 13px;
    color: var(--ui-ink-2);
  }

  .workspace select {
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font-size: 13px;
  }

  .credits {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--ui-ink);
    text-decoration: none;
  }

  .home:focus-visible,
  .credits:focus-visible {
    outline: 2px solid var(--ui-accent);
    outline-offset: 2px;
  }

  @media (max-width: 640px) {
    .word,
    .org,
    .workspace {
      display: none;
    }
  }
</style>
