<script lang="ts">
  import { FigmaAsk, findFrames, importFrames, type FigmaFrame } from '$lib/canvas/figma/import-client';

  type Landed = { nodes: unknown[]; undo: unknown[]; skipped: string[] };

  let { projectId, canvasId, at, settingsHref, onimported, onclose }: { projectId: string; canvasId: string; at: { x: number; y: number }; settingsHref: string; onimported: (landed: Landed) => void; onclose: () => void } = $props();

  const REFUSALS: Record<string, string> = {
    bad_link: 'That is not a figma.com design link.',
    token_rejected: 'Figma rejected the token. Check it in Settings.',
    not_found: 'Figma cannot find that file, or the token cannot see it.',
    no_frames: 'Pick at least one frame.',
    unreadable: 'Nothing in those frames could be read.',
    rate_limited: 'Too many requests. Try again in a minute.',
    unavailable: 'Figma did not answer. Try again.'
  };
  const FALLBACK_REFUSAL = 'Could not import from Figma.';

  let url = $state('');
  let frames = $state<FigmaFrame[] | null>(null);
  let picked = $state(new Set<string>());
  let busy = $state(false);
  let noToken = $state(false);
  let message = $state<string | null>(null);

  const groups = $derived(Object.entries(Object.groupBy(frames ?? [], (f) => f.page)));

  function toggle(id: string) {
    const next = new Set(picked);
    if (!next.delete(id)) {
      next.add(id);
    }
    picked = next;
  }

  async function find() {
    busy = true;
    message = null;
    noToken = false;
    const got = await findFrames({ projectId, url });
    busy = false;
    if (got.ask === FigmaAsk.NoToken) {
      noToken = true;
      return;
    }
    if (got.ask === FigmaAsk.Refused) {
      message = REFUSALS[got.error] ?? FALLBACK_REFUSAL;
      return;
    }
    frames = got.frames;
    picked = new Set(got.selected ? [got.selected] : []);
    message = got.frames.length ? null : 'No frames on the pages of this file.';
  }

  async function bring() {
    busy = true;
    message = null;
    const got = await importFrames({ projectId, canvasId, url, frameIds: [...picked], at });
    busy = false;
    if (got.ask === FigmaAsk.NoToken) {
      noToken = true;
      return;
    }
    if (got.ask === FigmaAsk.Refused) {
      message = REFUSALS[got.error] ?? FALLBACK_REFUSAL;
      return;
    }
    onimported(got);
    onclose();
  }
</script>

<div class="fg-overlay" role="button" tabindex="-1" aria-label="Cancel" onclick={(e) => e.target === e.currentTarget && onclose()} onkeydown={(e) => e.key === 'Escape' && onclose()}>
  <div class="fg-card" role="dialog" aria-modal="true" aria-label="Import from Figma" data-testid="figma-import-dialog">
    <h3>Import from Figma</h3>
    <form
      class="fg-link"
      onsubmit={(e) => {
        e.preventDefault();
        void find();
      }}
    >
      <input type="url" placeholder="https://www.figma.com/design/…" aria-label="Figma link" bind:value={url} data-testid="figma-import-url" />
      <button class="fg-btn" type="submit" disabled={busy || !url.trim()} data-testid="figma-import-find">Find frames</button>
    </form>

    {#if noToken}
      <p class="fg-note" role="status" data-testid="figma-import-no-token">Add a Figma personal access token to import. <a href={settingsHref}>Open settings</a></p>
    {/if}
    {#if message}
      <p class="fg-note" role="alert" data-testid="figma-import-message">{message}</p>
    {/if}

    {#if frames?.length}
      <div class="fg-frames" data-testid="figma-import-frames">
        {#each groups as [page, list] (page)}
          <h4>{page}</h4>
          {#each list ?? [] as frame (frame.id)}
            <label class="fg-row"><input type="checkbox" checked={picked.has(frame.id)} onchange={() => toggle(frame.id)} data-testid={`figma-frame-${frame.id}`} />{frame.name}<span>{frame.width} × {frame.height}</span></label>
          {/each}
        {/each}
      </div>
    {/if}

    <div class="fg-actions">
      <button class="fg-btn" type="button" onclick={onclose}>Cancel</button>
      <button class="fg-btn primary" type="button" disabled={busy || !picked.size} onclick={bring} data-testid="figma-import-run">Import</button>
    </div>
  </div>
</div>

<style>
  .fg-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; padding: 24px; }
  .fg-card { background: var(--paper, #fff); padding: 22px; width: 100%; max-width: 440px; max-height: 80vh; box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column; gap: 10px; }
  .fg-card h3 { margin: 0 0 6px; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
  .fg-card h4 { margin: 8px 0 2px; font-size: 12px; font-weight: 600; color: var(--ink-soft, #6e6e73); }
  .fg-link { display: flex; gap: 8px; }
  .fg-link input { flex: 1; min-width: 0; font: inherit; font-size: 13px; padding: 6px 8px; border: 1px solid var(--line, #e3e3e6); background: var(--paper, #fff); color: var(--ink, #1d1d1f); }
  .fg-note { margin: 0; font-size: 13px; color: var(--ink-soft, #6e6e73); }
  .fg-frames { overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
  .fg-row { display: flex; align-items: center; gap: 8px; font-size: 13.5px; }
  .fg-row span { margin-left: auto; color: var(--ink-soft, #6e6e73); font-size: 12px; }
  .fg-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }
  .fg-btn { font: inherit; font-size: 13.5px; font-weight: 600; padding: 8px 14px; cursor: pointer; background: var(--paper-2, #f5f5f7); color: var(--ink, #1d1d1f); border: 1px solid var(--line, #e3e3e6); }
  .fg-btn.primary { background: var(--ink, #1d1d1f); color: var(--paper, #fff); }
  .fg-btn:disabled { opacity: 0.5; cursor: default; }
</style>
