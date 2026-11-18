<script lang="ts">
  import { Breakpoint, LIVE_WIDTH } from '$lib/canvas/live-frame';

  let { routes, onadd, onclose }: { routes: string[]; onadd: (route: string, breakpoint: Breakpoint) => void; onclose: () => void } = $props();

  let route = $state('/');
  let breakpoint = $state(Breakpoint.Desktop);
  const BREAKPOINTS = Object.values(Breakpoint);
</script>

<div class="ui-overlay" role="button" tabindex="-1" aria-label="Cancel" onclick={(e) => e.target === e.currentTarget && onclose()} onkeydown={(e) => e.key === 'Escape' && onclose()}>
  <div class="ui-card rounded-lg" role="dialog" aria-modal="true" aria-label="Add live frame" data-testid="live-frame-dialog">
    <h3>Add live frame</h3>
    <p class="ui-note">A page of your running dev server. Edits on disk show here as you save.</p>
    <form
      class="ui-form"
      onsubmit={(e) => {
        e.preventDefault();
        onadd(route, breakpoint);
      }}
    >
      <input class="rounded-sm" aria-label="Page path" list="live-routes" bind:value={route} placeholder="/pricing" data-testid="live-frame-route" />
      <datalist id="live-routes">
        {#each routes as r (r)}
          <option value={r}></option>
        {/each}
      </datalist>
      <div class="ui-tabs rounded-sm" role="tablist">
        {#each BREAKPOINTS as b (b)}
          <button type="button" class="rounded-sm" role="tab" aria-selected={breakpoint === b} onclick={() => (breakpoint = b)} data-testid={`live-frame-${b}`}>{b} · {LIVE_WIDTH[b]}</button>
        {/each}
      </div>
      <div class="ui-row ui-end">
        <button class="ui-btn primary rounded-sm" type="submit" disabled={!route.trim()} data-testid="live-frame-add">Add</button>
      </div>
    </form>
  </div>
</div>

<style>
  .ui-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; padding: 24px; }
  .ui-card { background: var(--paper, #fff); padding: 22px; width: 100%; max-width: 420px; box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column; gap: 10px; }
  .ui-card h3 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
  .ui-note { margin: 0; font-size: 13px; color: var(--ink-soft, #6e6e73); }
  .ui-form { display: flex; flex-direction: column; gap: 8px; }
  .ui-form input { font: inherit; font-size: 13px; padding: 6px 8px; border: 1px solid var(--line, #e3e3e6); background: var(--paper, #fff); color: var(--ink, #1d1d1f); }
  .ui-tabs { display: flex; gap: 2px; padding: 2px; background: var(--paper-soft, #f5f5f7); align-self: flex-start; }
  .ui-tabs button { font: inherit; font-size: 12.5px; padding: 4px 10px; border: 0; background: transparent; color: var(--ink-soft, #6e6e73); cursor: pointer; }
  .ui-tabs button[aria-selected='true'] { background: var(--paper, #fff); color: var(--ink, #1d1d1f); }
  .ui-row { display: flex; gap: 8px; }
  .ui-end { justify-content: flex-end; }
  .ui-btn { font: inherit; font-size: 13px; font-weight: 500; padding: 6px 14px; border: 0; cursor: pointer; }
  .ui-btn.primary { background: var(--ink, #1d1d1f); color: var(--paper, #fff); }
  .ui-btn:disabled { opacity: 0.4; cursor: default; }
</style>
