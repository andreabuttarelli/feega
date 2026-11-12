<script lang="ts">
  import { testAccount, type TestAccount } from '$lib/canvas/code-import-client';

  let { projectId }: { projectId: string } = $props();

  let account = $state<TestAccount | null | undefined>(undefined);

  $effect(() => {
    const id = projectId;
    void testAccount(id).then((found) => (account = found));
  });

  const settingsHref = $derived(`/p/${projectId}/settings/project#app-account`);
</script>

<p class="sign-in" data-testid="code-import-sign-in">
  <strong>Sign-in for protected pages:</strong>
  {#if account === undefined}
    checking…
  {:else if account}
    signs in as <span data-testid="code-import-sign-in-email">{account.email}</span> on the app's {new URL(account.loginUrl).pathname} page. <a href={settingsHref} target="_blank" rel="noopener">Change</a>
  {:else}
    none. Pages behind a login are reported, not imported. <a href={settingsHref} target="_blank" rel="noopener" data-testid="code-import-sign-in-add">Add a TEST account</a> (the AI can see it).
  {/if}
</p>

<style>
  .sign-in { margin: 0; font-size: 12px; color: var(--ink-soft, #6e6e73); }
  .sign-in strong { font-weight: 600; color: var(--ink, #1d1d1f); }
  .sign-in a { color: var(--ink, #1d1d1f); }
</style>
