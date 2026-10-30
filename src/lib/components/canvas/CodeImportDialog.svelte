<script lang="ts">
  import { importCode, type CodeLanded, type CodeTarget } from '$lib/canvas/code-import-client';

  let { projectId, canvasId, at, onimported, onclose }: { projectId: string; canvasId: string; at: { x: number; y: number }; onimported: (landed: CodeLanded) => void; onclose: () => void } = $props();

  const Source = { Repo: 'repo', Storybook: 'storybook' } as const;
  type Source = (typeof Source)[keyof typeof Source];

  const REFUSALS: Record<string, string> = {
    invalid: 'Enter a public GitHub repository link and up to 8 page paths starting with /, or a Storybook link.',
    no_sandbox: 'Code import is not available right now.',
    run_failed: 'The app could not be started.',
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
  let busy = $state(false);
  let message = $state<string | null>(null);
  let detail = $state<string | null>(null);

  const linked = (raw: string) => (HTTP.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);

  const TARGETS: Record<Source, () => CodeTarget> = {
    [Source.Repo]: () => ({ repo: linked(repo), routes: routes.split(/[\s,]+/).filter(Boolean) }),
    [Source.Storybook]: () => ({ storybook: linked(storybook) })
  };

  const ready = $derived(source === Source.Repo ? Boolean(repo.trim()) : Boolean(storybook.trim()));

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
        <p class="ui-note">A public React, Vue or Svelte app runs in a sandbox. Its components become main components, their props variants. Several pages, separated by spaces, land as boards of one frame sharing the components.</p>
        <input class="rounded-sm" type="text" inputmode="url" placeholder="https://github.com/owner/repo" aria-label="Repository" bind:value={repo} data-testid="code-import-repo" />
        <input class="rounded-sm" type="text" placeholder="/  /settings  /users" aria-label="Pages" bind:value={routes} data-testid="code-import-route" />
      {:else}
        <p class="ui-note">A public Storybook: each story is read without running the app, its components become main components, their args variants.</p>
        <input class="rounded-sm" type="text" inputmode="url" placeholder="https://storybook.example.com" aria-label="Storybook" bind:value={storybook} data-testid="code-import-storybook" />
      {/if}
      <div class="ui-row ui-end">
        <button class="ui-btn primary rounded-sm" type="submit" disabled={busy || !ready} data-testid="code-import-run">{busy ? (source === Source.Repo ? 'Starting the app…' : 'Reading the stories…') : 'Import'}</button>
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
  .ui-form input { flex: 1; min-width: 0; font: inherit; font-size: 13px; padding: 6px 8px; border: 1px solid var(--line, #e3e3e6); background: var(--paper, #fff); color: var(--ink, #1d1d1f); }
  .ui-note { margin: 0; font-size: 13px; color: var(--ink-soft, #6e6e73); }
  .ui-detail { margin: 0; font-size: 11px; max-height: 120px; overflow: auto; padding: 8px; background: var(--paper-soft, #f5f5f7); white-space: pre-wrap; }
  .ui-btn { font: inherit; font-size: 13.5px; font-weight: 600; padding: 8px 14px; cursor: pointer; border: 1px solid var(--line, #e3e3e6); }
  .ui-btn.primary { background: var(--ink, #1d1d1f); color: var(--paper, #fff); }
  .ui-btn:disabled { opacity: 0.5; cursor: default; }
</style>
