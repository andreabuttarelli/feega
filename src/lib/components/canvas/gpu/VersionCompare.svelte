<script lang="ts">
  import { changedRegions, DiffMode, type Pixels, type Region } from '$lib/canvas/pixel-diff';
  import { VersionAction, versionAction, type FileDiff, type Timeline } from '$lib/canvas/version-client';
  import { LineMove, lineDiff } from '$lib/canvas/line-diff';

  type Side = { url: string; label: string };

  type History = { line: Timeline; busy: boolean; onpick: (sha: string) => void };

  let { projectId, versionId, before, after, history = null, onclose, onchanged }: { projectId: string; versionId: string; before: Side; after: Side; history?: History | null; onclose: () => void; onchanged: () => unknown } = $props();

  const ACTION_LABEL: Record<VersionAction, string> = { [VersionAction.Restore]: 'Restore this version', [VersionAction.Variant]: 'Make variant', [VersionAction.CodeDiff]: 'Open code diff' };
  const LINE_MARK: Record<LineMove, string> = { [LineMove.Same]: ' ', [LineMove.Removed]: '-', [LineMove.Added]: '+' };

  let note = $state('');
  let acting = $state(false);
  let codeDiff = $state<FileDiff[] | null>(null);

  const ACTION_DONE: Record<VersionAction, (body: Record<string, unknown>) => void> = {
    [VersionAction.Restore]: (body) => {
      note = `${(body.paths as string[]).length} files restored; push them from Changes`;
      onchanged();
    },
    [VersionAction.Variant]: () => {
      note = 'Variant placed below the version';
    },
    [VersionAction.CodeDiff]: (body) => {
      codeDiff = body.files as FileDiff[];
    }
  };

  async function act(action: VersionAction) {
    acting = true;
    const body = await versionAction(projectId, versionId, action);
    acting = false;
    if (!body) {
      note = 'That did not work, try again';
      return;
    }
    ACTION_DONE[action](body);
  }

  let scrub = $state(0);
  $effect(() => {
    scrub = history?.line.at ?? 0;
  });
  const shown = $derived(history?.line.steps[scrub] ?? null);
  const SHORT_SHA = 7;

  const MAX_SIDE = 900;
  const MODE_LABEL: Record<DiffMode, string> = { [DiffMode.Overlay]: 'Overlay', [DiffMode.Slider]: 'Slider' };

  let mode = $state(DiffMode.Overlay);
  let split = $state(50);
  let regions = $state<Region[] | null>(null);
  let failed = $state(false);

  const load = (url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });

  function pixelsOf(img: HTMLImageElement, width: number, height: number): Pixels {
    const canvas = Object.assign(document.createElement('canvas'), { width, height });
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, width, height);
    return { width, height, data: ctx.getImageData(0, 0, width, height).data };
  }

  $effect(() => {
    regions = null;
    failed = false;
    Promise.all([load(before.url), load(after.url)]).then(
      ([a, b]) => {
        const scale = Math.min(1, MAX_SIDE / Math.max(a.naturalWidth, a.naturalHeight));
        const width = Math.round(a.naturalWidth * scale);
        const height = Math.round(Math.max(a.naturalHeight, b.naturalHeight) * scale);
        regions = changedRegions(pixelsOf(a, width, height), pixelsOf(b, width, height));
      },
      () => (failed = true)
    );
  });

  const box = (r: Region) => `left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%`;
</script>

<div class="version-compare" data-testid="version-compare" role="dialog" aria-label="Compare versions">
  <header>
    <span class="names">{before.label} → {after.label}</span>
    <div class="modes" role="tablist">
      {#each Object.values(DiffMode) as m (m)}
        <button type="button" role="tab" aria-selected={mode === m} class:on={mode === m} data-testid="diff-mode-{m}" onclick={() => (mode = m)}>{MODE_LABEL[m]}</button>
      {/each}
    </div>
    <span class="count" data-testid="diff-count">{failed ? 'posters unavailable' : regions === null ? 'comparing…' : `${regions.length} changed`}</span>
    <button type="button" class="close" aria-label="Close" onclick={onclose}>×</button>
  </header>

  {#if history && history.line.steps.length > 1}
    <div class="timeline" data-testid="version-timeline">
      <input type="range" min="0" max={history.line.steps.length - 1} step="1" bind:value={scrub} disabled={history.busy} aria-label="Commit history" data-testid="version-scrubber" onchange={() => shown && history.onpick(shown.sha)} />
      {#if shown}
        <span class="commit">{shown.sha.slice(0, SHORT_SHA)} · {shown.message} · {shown.author}</span>
      {/if}
    </div>
  {/if}

  <div class="actions">
    {#each Object.values(VersionAction) as a (a)}
      <button type="button" disabled={acting} data-testid="version-action-{a}" onclick={() => act(a)}>{ACTION_LABEL[a]}</button>
    {/each}
    {#if note}
      <span class="note" data-testid="version-note">{note}</span>
    {/if}
  </div>

  {#if codeDiff}
    <div class="code" data-testid="version-code-diff">
      <button type="button" class="back" onclick={() => (codeDiff = null)}>Back to visual diff</button>
      {#each codeDiff as file (file.path)}
        <div class="file">{file.path}</div>
        <pre>{#each lineDiff(file.before, file.after) as line, i (i)}<span class={line.move}>{LINE_MARK[line.move]} {line.text}
</span>{/each}</pre>
      {:else}
        <p class="note">No code changes between these versions.</p>
      {/each}
    </div>
  {:else}
  <div class="stage">
    {#if mode === DiffMode.Overlay}
      <img src={after.url} alt={after.label} />
      {#each regions ?? [] as r, i (i)}
        <div class="region" data-testid="version-diff-region" style={box(r)}></div>
      {/each}
    {:else}
      <img src={after.url} alt={after.label} />
      <img class="before" src={before.url} alt={before.label} style="clip-path: inset(0 {100 - split}% 0 0)" />
      <div class="divider" style="left:{split}%"></div>
      <input class="slider" type="range" min="0" max="100" bind:value={split} aria-label="Before and after" data-testid="diff-slider" />
    {/if}
  </div>
  {/if}
</div>

<style>
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--ui-line);
    font-size: 12px;
  }
  .actions button,
  .back {
    border: 1px solid var(--ui-line);
    background: transparent;
    color: inherit;
    padding: 3px 8px;
    border-radius: var(--ui-radius-sm);
    cursor: pointer;
  }
  .note {
    color: var(--ui-muted);
  }
  .code {
    overflow: auto;
    padding: 8px 10px;
    font-size: 11px;
  }
  .file {
    margin: 8px 0 4px;
    font-weight: 600;
  }
  pre {
    margin: 0;
    font-family: ui-monospace, monospace;
    white-space: pre-wrap;
  }
  pre .removed {
    background: rgb(255 59 92 / 0.15);
  }
  pre .added {
    background: rgb(52 199 89 / 0.18);
  }
  .version-compare {
    position: absolute;
    left: 72px;
    top: 56px;
    width: min(560px, calc(100% - 32px));
    max-height: calc(100% - 72px);
    display: flex;
    flex-direction: column;
    background: var(--ui-surface);
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-lg);
    box-shadow: var(--ui-shadow-lg, 0 8px 24px rgb(0 0 0 / 0.18));
    pointer-events: auto;
    overflow: hidden;
    z-index: 30;
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--ui-line);
    font-size: 12px;
  }
  .names {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .modes {
    display: flex;
    gap: 2px;
  }
  .modes button,
  .close {
    border: 0;
    background: transparent;
    padding: 3px 8px;
    border-radius: var(--ui-radius-sm);
    color: inherit;
    cursor: pointer;
  }
  .modes button.on {
    background: var(--ui-wash);
  }
  .count {
    color: var(--ui-muted);
  }
  .timeline {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--ui-line);
    font-size: 11px;
  }
  .timeline input {
    width: 100%;
  }
  .commit {
    color: var(--ui-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .stage {
    position: relative;
    overflow: auto;
  }
  .stage img {
    display: block;
    width: 100%;
  }
  .stage .before {
    position: absolute;
    inset: 0;
  }
  .region {
    position: absolute;
    border: 2px solid #ff3b5c;
    background: rgb(255 59 92 / 0.18);
    border-radius: var(--ui-radius-xs);
  }
  .divider {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #fff;
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.3);
  }
  .slider {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: ew-resize;
  }
</style>
