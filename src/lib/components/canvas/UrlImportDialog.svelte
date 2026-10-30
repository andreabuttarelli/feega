<script lang="ts">
  import { onMount } from 'svelte';
  import { importPage, type ImportExtent, type UrlLanded } from '$lib/canvas/url-import-client';
  import { startHost } from '$lib/start-url';

  let {
    projectId,
    canvasId,
    at,
    startUrl = null,
    onimported,
    onclose
  }: { projectId: string; canvasId: string; at: { x: number; y: number }; startUrl?: string | null; onimported: (landed: UrlLanded) => void; onclose: () => void } = $props();

  const REFUSALS: Record<string, string> = {
    invalid: 'Enter a web page address.',
    not_public: 'Only public http(s) pages can be imported.',
    no_browser: 'Page import is not available right now.',
    failed: 'The page could not be opened.',
    unreadable: 'Nothing on that page could be read.',
    rate_limited: 'Too many imports. Try again in a minute.'
  };
  const FALLBACK_REFUSAL = 'Could not import that page.';

  const FIRST_SCREENS: ImportExtent = 'top';

  let url = $state('');
  let busy = $state(false);
  let message = $state<string | null>(null);
  let site = $state<string | null>(null);
  let sections = $state(true);
  let tokens = $state(true);

  const title = $derived(site ? (busy ? `Importing ${site}…` : `Couldn't import ${site}`) : 'Import from URL');

  async function bring(typed: string, extent?: ImportExtent) {
    busy = true;
    message = null;
    const got = await importPage({ projectId, canvasId, url: /^https?:\/\//i.test(typed) ? typed : `https://${typed}`, at, extent, sections, tokens });
    busy = false;
    if (!got.ok) {
      message = REFUSALS[got.error] ?? FALLBACK_REFUSAL;
      return;
    }
    onimported(got.landed);
    onclose();
  }

  onMount(() => {
    if (!startUrl) {
      return;
    }
    site = startHost(startUrl);
    void bring(startUrl, FIRST_SCREENS);
  });
</script>

<div class="ui-overlay" role="button" tabindex="-1" aria-label="Cancel" onclick={(e) => e.target === e.currentTarget && onclose()} onkeydown={(e) => e.key === 'Escape' && onclose()}>
  <div class="ui-card rounded-lg" role="dialog" aria-modal="true" aria-label="Import from URL" data-testid="url-import-dialog">
    <h3 data-testid="url-import-title" aria-live="polite">{title}</h3>
    {#if site && busy}
      <div class="ui-progress" role="progressbar" aria-label={title} data-testid="url-import-progress"></div>
    {/if}
    {#if !(site && busy)}
    <form
      class="ui-link"
      onsubmit={(e) => {
        e.preventDefault();
        void bring(url.trim(), site ? FIRST_SCREENS : undefined);
      }}
    >
      <input class="rounded-sm" type="text" inputmode="url" placeholder="https://example.com" aria-label="Page address" bind:value={url} data-testid="url-import-url" />
      <button class="ui-btn primary rounded-sm" type="submit" disabled={busy || !url.trim()} data-testid="url-import-run">{busy ? 'Importing…' : site ? 'Try another URL' : 'Import'}</button>
    </form>
    <label class="ui-check"><input class="rounded-xs" type="checkbox" bind:checked={sections} data-testid="url-import-sections" /> Split into sections (Nav, Hero, Footer…)</label>
    <label class="ui-check"><input class="rounded-xs" type="checkbox" bind:checked={tokens} data-testid="url-import-tokens" /> Extract styles and variables (colours, type, effects)</label>
    {/if}
    {#if message}
      <p class="ui-note" role="alert" data-testid="url-import-message">{message}</p>
    {/if}
  </div>
</div>

<style>
  .ui-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; padding: 24px; }
  .ui-card { background: var(--paper, #fff); padding: 22px; width: 100%; max-width: 440px; box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column; gap: 10px; }
  .ui-card h3 { margin: 0 0 6px; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
  .ui-link { display: flex; gap: 8px; }
  .ui-link input { flex: 1; min-width: 0; font: inherit; font-size: 13px; padding: 6px 8px; border: 1px solid var(--line, #e3e3e6); background: var(--paper, #fff); color: var(--ink, #1d1d1f); }
  .ui-progress { height: 2px; background: linear-gradient(90deg, transparent, var(--ink, #1d1d1f), transparent) 0 0 / 40% 100% no-repeat var(--line, #e3e3e6); animation: ui-progress 1.2s ease-in-out infinite; }
  @keyframes ui-progress { from { background-position: -40% 0; } to { background-position: 140% 0; } }
  .ui-check { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-soft, #6e6e73); }
  .ui-note { margin: 0; font-size: 13px; color: var(--ink-soft, #6e6e73); }
  .ui-btn { font: inherit; font-size: 13.5px; font-weight: 600; padding: 8px 14px; cursor: pointer; border: 1px solid var(--line, #e3e3e6); }
  .ui-btn.primary { background: var(--ink, #1d1d1f); color: var(--paper, #fff); }
  .ui-btn:disabled { opacity: 0.5; cursor: default; }
</style>
