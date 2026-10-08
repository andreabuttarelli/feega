<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import Copy from '@lucide/svelte/icons/copy';
  import Download from '@lucide/svelte/icons/download';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import type { MotionDoc } from '$lib/motion/doc';
  import { BUNDLE_FILE, type InteractiveBundle } from '$lib/motion/interactive/bundle';
  import { OUTSIDES, PLAY_MODES, PLAY_MODE_LABEL, Outside, type Interactive } from '$lib/motion/interactive/settings';
  import { REACTION_LABEL, type Reaction } from '$lib/motion/interactive/summary';

  type Hosted = { published: boolean; url: string };

  let {
    doc,
    bundle,
    href,
    hosted,
    hostedSnippet,
    reactions,
    settings = $bindable(),
    busy,
    error,
    updated = false,
    onpublish,
    onunpublish,
    onpresets
  }: {
    doc: MotionDoc;
    bundle: InteractiveBundle | null;
    href: string;
    hosted: Hosted | null;
    hostedSnippet: string;
    reactions: Reaction[];
    settings: Interactive;
    busy: boolean;
    error: string;
    updated?: boolean;
    onpublish: () => void;
    onunpublish: () => void;
    onpresets?: () => void;
  } = $props();

  const Copied = { None: '', Hosted: 'hosted', File: 'file' } as const;
  type Copied = (typeof Copied)[keyof typeof Copied];

  const COPIED_MS = 1600;
  const BYTES_PER_KB = 1024;
  const BYTES_PER_MB = BYTES_PER_KB * 1024;
  const OUTSIDE_LABEL: Record<Outside, string> = { [Outside.Fallback]: 'Go back to their default', [Outside.Hold]: 'Keep their last value' };

  let copied = $state<Copied>(Copied.None);
  let expanded = $state(false);
  let copiedTimer: ReturnType<typeof setTimeout> | null = null;

  const published = $derived(Boolean(hosted?.published));
  const weight = $derived(bundle ? (bundle.bytes >= BYTES_PER_MB ? `${(bundle.bytes / BYTES_PER_MB).toFixed(1)} MB` : `${Math.ceil(bundle.bytes / BYTES_PER_KB)} KB`) : '…');

  async function copy(text: string, which: Copied) {
    await navigator.clipboard.writeText(text);
    copied = which;
    if (copiedTimer) {
      clearTimeout(copiedTimer);
    }
    copiedTimer = setTimeout(() => (copied = Copied.None), COPIED_MS);
  }
</script>

<div class="embed" data-testid="interactive-export">
  <div class="preview" style={`aspect-ratio: ${doc.width} / ${doc.height}`} data-testid="interactive-preview">
    {#if href}
      <iframe src={href} title="Embed preview" sandbox="allow-scripts" loading="lazy"></iframe>
    {:else}
      <span class="hint">Preparing preview…</span>
    {/if}
  </div>

  <section class="reacts" data-testid="interactive-reacts">
    <h3>Interactivity</h3>
    {#if reactions.length}
      <ul>
        {#each reactions as reaction (reaction)}<li>{REACTION_LABEL[reaction]}</li>{/each}
      </ul>
    {:else}
      <p class="hint">Plays as a video — nothing reacts yet. Ask the agent to make it interactive.</p>
    {/if}
    {#if onpresets}<button type="button" class="link" onclick={onpresets} data-testid="interactive-presets">Interactive presets</button>{/if}
  </section>

  {#if error}<p class="warn" role="alert">{error}</p>{/if}

  <section class="publish" data-testid="interactive-hosted">
    {#if published}
      <p class="lead">Paste this where you want it on your site</p>
      <div class="code" class:open={expanded}>
        <pre data-testid="interactive-hosted-snippet">{hostedSnippet}</pre>
      </div>
      <button type="button" class="link more" onclick={() => (expanded = !expanded)}>{expanded ? 'Show less' : 'Show all code'}</button>
      <button type="button" class="primary wide" onclick={() => copy(hostedSnippet, Copied.Hosted)} data-testid="interactive-copy">
        {#if copied === Copied.Hosted}<Check size={16} /> Copied{:else}<Copy size={16} /> Copy code{/if}
      </button>
      <div class="status">
        <span><i class="dot"></i>Published{updated ? ' · updated just now' : ''}</span>
        <span class="quiet">
          <button type="button" class="link" disabled={busy || !bundle} onclick={onpublish} data-testid="interactive-republish">{busy ? 'Publishing…' : 'Update'}</button>
          <button type="button" class="link" disabled={busy} onclick={onunpublish} data-testid="interactive-unpublish">Unpublish</button>
        </span>
      </div>
    {:else}
      <button type="button" class="primary wide" disabled={busy || !hosted || !bundle} onclick={onpublish} data-testid="interactive-publish">{busy ? 'Publishing…' : 'Publish embed'}</button>
      <p class="hint center">feega hosts it. You get a snippet to paste.</p>
    {/if}
  </section>

  <details class="advanced" data-testid="interactive-advanced">
    <summary><ChevronRight size={14} /> Advanced</summary>
    <div class="rows">
      <label class="row">
        <span>Playback</span>
        <select bind:value={settings.playback} data-testid="interactive-playback">
          {#each PLAY_MODES as mode (mode)}<option value={mode}>{PLAY_MODE_LABEL[mode]}</option>{/each}
        </select>
      </label>
      <label class="row">
        <span>Loop</span>
        <input type="checkbox" bind:checked={settings.loop} data-testid="interactive-loop" />
      </label>
      <label class="row">
        <span>Nested layers outside their cell</span>
        <select bind:value={settings.outside} data-testid="interactive-outside">
          {#each OUTSIDES as outside (outside)}<option value={outside}>{OUTSIDE_LABEL[outside]}</option>{/each}
        </select>
      </label>

      <h3>Host the file yourself</h3>
      <p class="hint">Upload {BUNDLE_FILE} next to your page, then paste this. <span data-testid="interactive-weight">One HTML file, assets included · {weight}</span></p>
      <div class="code">
        <pre data-testid="interactive-snippet">{bundle?.snippet ?? ''}</pre>
      </div>
      <div class="pair">
        <button type="button" class="secondary" disabled={!bundle} onclick={() => bundle && copy(bundle.snippet, Copied.File)} data-testid="interactive-copy-snippet">
          {#if copied === Copied.File}<Check size={16} /> Copied{:else}<Copy size={16} /> Copy snippet{/if}
        </button>
        <a class="secondary" href={href || undefined} download={BUNDLE_FILE} aria-disabled={!bundle} data-testid="interactive-download"><Download size={16} /> Download HTML</a>
      </div>
    </div>
  </details>
</div>

<style>
  .embed {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-6);
  }

  h3 {
    margin: 0;
    font-size: var(--ui-text-sm);
    font-weight: 600;
  }

  .preview {
    display: grid;
    place-items: center;
    width: 100%;
    max-height: 240px;
    background: var(--ui-surface);
    overflow: hidden;
  }

  .preview iframe {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
  }

  .reacts {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ui-space-2);
  }

  .reacts ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-2);
  }

  .reacts li {
    padding: 4px 10px;
    background: var(--ui-accent-wash);
    color: var(--ui-accent);
  }

  .hint {
    margin: 0;
    color: var(--ui-text-2);
    line-height: 1.5;
  }

  .center {
    text-align: center;
  }

  .lead {
    margin: 0;
    font-weight: 600;
  }

  .warn {
    margin: 0;
    color: var(--ui-warn);
  }

  .publish {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3);
  }

  .code {
    background: var(--ui-field);
  }

  .code pre {
    margin: 0;
    padding: var(--ui-space-3);
    max-height: 80px;
    overflow: hidden;
    mask-image: linear-gradient(#000 55%, transparent);
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    line-height: 1.6;
    color: var(--ui-text-2);
    white-space: pre-wrap;
    word-break: break-all;
  }

  .code.open pre {
    mask-image: none;
    max-height: 240px;
    overflow: auto;
  }

  .more {
    align-self: flex-end;
    min-height: 0;
    margin-top: calc(-1 * var(--ui-space-2));
    font-size: var(--ui-text-xs);
  }

  input[type='checkbox'] {
    accent-color: var(--ui-accent);
  }

  .status {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--ui-space-3);
    color: var(--ui-text-2);
  }

  .status > span:first-child {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ui-ok);
  }

  .quiet {
    display: inline-flex;
    gap: var(--ui-space-4);
  }

  .link {
    min-height: var(--ui-hit);
    padding: 0;
    border: 0;
    color: var(--ui-text-2);
    font-size: var(--ui-text-sm);
    background: none;
  }

  .link:hover:not(:disabled) {
    color: var(--ui-ink);
  }

  .reacts .link {
    color: var(--ui-accent);
  }

  .advanced summary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: var(--ui-hit);
    color: var(--ui-text-2);
    cursor: pointer;
    list-style: none;
  }

  .advanced summary::-webkit-details-marker {
    display: none;
  }

  .advanced[open] summary :global(svg) {
    transform: rotate(90deg);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3);
    padding-top: var(--ui-space-3);
  }

  .rows h3 {
    margin-top: var(--ui-space-4);
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--ui-space-4);
    min-height: var(--ui-hit);
    color: var(--ui-text-2);
  }

  .row select {
    max-width: 60%;
    height: var(--ui-hit);
    padding: 0 var(--ui-space-2);
    border: 0;
    background: var(--ui-field);
    color: var(--ui-ink);
    font: inherit;
  }

  .pair {
    display: flex;
    gap: var(--ui-space-2);
  }

  .primary,
  .secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: var(--ui-hit);
    padding: 0 var(--ui-space-4);
    font-size: var(--ui-text-sm);
    font-weight: 600;
    text-decoration: none;
  }

  .wide {
    width: 100%;
    height: 44px;
  }

  .primary {
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
  }

  .primary:disabled {
    background: var(--ui-field);
    color: var(--ui-text-3);
  }

  .secondary {
    flex: 1;
    background: var(--ui-field);
    color: var(--ui-ink);
  }
</style>
