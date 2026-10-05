<script lang="ts">
  import Download from '@lucide/svelte/icons/download';
  import Copy from '@lucide/svelte/icons/copy';
  import type { MotionDoc } from '$lib/motion/doc';
  import type { BrandTokens } from '$lib/motion/brand';
  import type { AudioAnalysis } from '$lib/motion/audio-analysis';
  import { BUNDLE_FILE, interactiveBundle, type InteractiveBundle } from '$lib/motion/interactive/bundle';
  import { liveLanes } from '$lib/motion/interactive/live';
  import { flattenComps } from '$lib/motion/precomp';
  import { OUTSIDES, PLAY_MODES, PLAY_MODE_LABEL, Outside, interactiveOf, type Interactive } from '$lib/motion/interactive/settings';

  let { doc, tokens, assetUrls, analyses = {}, fileName }: { doc: MotionDoc; tokens: BrandTokens; assetUrls: Record<string, string>; analyses?: Record<string, AudioAnalysis>; fileName: string } = $props();

  const BYTES_PER_KB = 1024;
  const BYTES_PER_MB = BYTES_PER_KB * 1024;
  const OUTSIDE_LABEL: Record<Outside, string> = { [Outside.Fallback]: 'goes back to its default', [Outside.Hold]: 'keeps its last value' };

  let settings = $state<Interactive>({ ...interactiveOf(doc) });
  let bundle = $state<InteractiveBundle | null>(null);
  let error = $state('');
  let copied = $state(false);
  const blobs = new Map<string, Promise<Blob>>();
  const fetchBlob = (url: string) => {
    if (!blobs.has(url)) {
      blobs.set(url, fetch(url).then((r) => r.blob()));
    }
    return blobs.get(url)!;
  };

  const live = $derived(liveLanes(flattenComps(doc)));
  const href = $derived(bundle ? URL.createObjectURL(new Blob([bundle.html], { type: 'text/html' })) : '');
  const weight = $derived(bundle ? (bundle.bytes >= BYTES_PER_MB ? `${(bundle.bytes / BYTES_PER_MB).toFixed(1)} MB` : `${Math.ceil(bundle.bytes / BYTES_PER_KB)} KB`) : '…');

  $effect(() => {
    const wanted = { ...settings };
    bundle = null;
    error = '';
    interactiveBundle({ doc, tokens, assetUrls, analyses, settings: wanted, title: fileName, fetchBlob }).then(
      (b) => (bundle = b),
      (e) => (error = e instanceof Error ? e.message : String(e))
    );
  });

  async function copy() {
    if (!bundle) {
      return;
    }
    await navigator.clipboard.writeText(bundle.snippet);
    copied = true;
  }
</script>

<dl data-testid="interactive-export">
  <dt>Reacts to</dt>
  <dd>
    {#if live.length}{live.length} propert{live.length === 1 ? 'y' : 'ies'} follow live input{:else}<span class="muted">Nothing reads input yet: turn on Interactive preview and apply a preset, or ask the agent.</span>{/if}
  </dd>
  <dt>Playback</dt>
  <dd>
    <select bind:value={settings.playback} data-testid="interactive-playback">
      {#each PLAY_MODES as mode (mode)}<option value={mode}>{PLAY_MODE_LABEL[mode]}</option>{/each}
    </select>
    <label><input type="checkbox" bind:checked={settings.loop} /> Loop</label>
  </dd>
  <dt>Nested</dt>
  <dd>
    Outside its cell a nested layer
    <select bind:value={settings.outside}>
      {#each OUTSIDES as outside (outside)}<option value={outside}>{OUTSIDE_LABEL[outside]}</option>{/each}
    </select>
  </dd>
  <dt>File</dt>
  <dd data-testid="interactive-weight">One HTML file, assets included · {weight}</dd>
</dl>

{#if error}<p class="warn" role="alert">{error}</p>{/if}

{#if bundle}
  <label class="snippet">Embed (host the file next to your page as {BUNDLE_FILE})<textarea readonly rows="4" data-testid="interactive-snippet">{bundle.snippet}</textarea></label>
  <div class="actions">
    <button type="button" class="secondary" onclick={copy}><Copy size={14} /> {copied ? 'Copied' : 'Copy snippet'}</button>
    <a class="primary" {href} download={BUNDLE_FILE} data-testid="interactive-download"><Download size={14} /> Download HTML</a>
  </div>
{/if}

<style>
  .snippet {
    display: grid;
    gap: 4px;
    font-size: 12px;
  }
  textarea {
    width: 100%;
    font-family: ui-monospace, monospace;
    font-size: 11px;
    resize: vertical;
  }
  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 8px;
  }
</style>
