<script lang="ts">
  import { importCode, type CodeLanded } from '$lib/canvas/code-import-client';

  let { projectId, canvasId, at, onimported, onclose }: { projectId: string; canvasId: string; at: { x: number; y: number }; onimported: (landed: CodeLanded) => void; onclose: () => void } = $props();

  const REFUSALS: Record<string, string> = {
    invalid: 'Enter a public GitHub repository link and a page path starting with /.',
    no_sandbox: 'Code import is not available right now.',
    run_failed: 'The app could not be started.',
    no_browser: 'Code import is not available right now.',
    failed: 'The page could not be opened.',
    unreadable: 'Nothing on that page could be read.',
    rate_limited: 'Two imports every ten minutes. Try again shortly.'
  };
  const FALLBACK_REFUSAL = 'Could not import that app.';

  let repo = $state('');
  let route = $state('/');
  let busy = $state(false);
  let message = $state<string | null>(null);
  let detail = $state<string | null>(null);

  async function bring() {
    busy = true;
    message = null;
    detail = null;
    const typed = repo.trim();
    const got = await importCode({ projectId, canvasId, repo: /^https?:\/\//i.test(typed) ? typed : `https://${typed}`, route: route.trim() || '/', at });
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
    <p class="ui-note">A public GitHub React app runs in a sandbox. Its components become main components, their props variants.</p>
    <form
      class="ui-form"
      onsubmit={(e) => {
        e.preventDefault();
        void bring();
      }}
    >
      <input class="rounded-sm" type="text" inputmode="url" placeholder="https://github.com/owner/repo" aria-label="Repository" bind:value={repo} data-testid="code-import-repo" />
      <div class="ui-row">
        <input class="rounded-sm" type="text" placeholder="/" aria-label="Page" bind:value={route} data-testid="code-import-route" />
        <button class="ui-btn primary rounded-sm" type="submit" disabled={busy || !repo.trim()} data-testid="code-import-run">{busy ? 'Starting the app…' : 'Import'}</button>
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
  .ui-form { display: flex; flex-direction: column; gap: 8px; }
  .ui-row { display: flex; gap: 8px; }
  .ui-form input { flex: 1; min-width: 0; font: inherit; font-size: 13px; padding: 6px 8px; border: 1px solid var(--line, #e3e3e6); background: var(--paper, #fff); color: var(--ink, #1d1d1f); }
  .ui-note { margin: 0; font-size: 13px; color: var(--ink-soft, #6e6e73); }
  .ui-detail { margin: 0; font-size: 11px; max-height: 120px; overflow: auto; padding: 8px; background: var(--paper-soft, #f5f5f7); white-space: pre-wrap; }
  .ui-btn { font: inherit; font-size: 13.5px; font-weight: 600; padding: 8px 14px; cursor: pointer; border: 1px solid var(--line, #e3e3e6); }
  .ui-btn.primary { background: var(--ink, #1d1d1f); color: var(--paper, #fff); }
  .ui-btn:disabled { opacity: 0.5; cursor: default; }
</style>
