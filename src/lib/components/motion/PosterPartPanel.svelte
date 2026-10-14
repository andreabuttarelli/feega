<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import type { AssetKind } from '$lib/motion/components';
  import { setProps, type OpResult } from '$lib/motion/timeline';
  import Trash from '@lucide/svelte/icons/trash-2';
  import { PartAction, PartKind, parsePart, partKind, partLabel, partText, runPart, writePartText } from '$lib/motion/poster-parts';
  import { markedPoster, photoStack, setPhotoFills } from '$lib/motion/poster-lines';
  import FillStack from './FillStack.svelte';
  import type { BrandTokens } from '$lib/motion/brand';

  type Asset = { id: string; kind: AssetKind; label: string; previewUrl: string };

  let { doc, clip, part, assets, tokens, onchange }: { doc: MotionDoc; clip: MotionClip; part: string; assets: Asset[]; tokens: BrandTokens; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  const kind = $derived(partKind(doc, clip, part));
  const index = $derived(parsePart(part).index ?? 0);
  const poster = $derived(markedPoster(String(clip.props.name)));
  const media = $derived(poster ? clip.props[poster.media] : undefined);

  function apply(result: OpResult, summary: string) {
    if (result.ok) {
      onchange(result.doc, summary);
    }
  }

  const writeMedia = (next: unknown, summary: string) => poster && apply(setProps(doc, clip.id, { [poster.media]: next }), summary);

  const BODY: Record<PartKind, Snippet | null> = { [PartKind.Line]: lineBody, [PartKind.Photo]: photoBody, [PartKind.Arrow]: arrowBody, [PartKind.Text]: null, [PartKind.Other]: null };
  const body = $derived(BODY[kind]);
  const PART_KIND_LABEL: Record<PartKind, string> = { [PartKind.Line]: 'Line', [PartKind.Photo]: 'Photo', [PartKind.Arrow]: 'Arrow', [PartKind.Text]: 'Text', [PartKind.Other]: 'Part' };

  const remove = () => apply(runPart(doc, clip, part, PartAction.Delete), `Delete ${partLabel(doc, clip, part)}`);
</script>

{#snippet lineBody()}
  <input type="text" class="one" data-testid="part-text" aria-label={partLabel(doc, clip, part)} value={partText(clip, part)} onchange={(e) => apply(writePartText(doc, clip.id, part, e.currentTarget.value), 'Edit text')} />
{/snippet}

{#snippet photoBody()}
  <div data-testid="part-photo">
    <FillStack title="Fill" fills={photoStack(media, index)} {assets} {tokens} onchange={(fills, summary) => writeMedia(setPhotoFills(media, index, fills), summary)} />
  </div>
  <button type="button" class="delete" data-testid="part-delete" onclick={remove}><Trash size={12} /> Delete photo</button>
{/snippet}

{#snippet arrowBody()}
  <label class="field">Show arrow <input type="checkbox" checked onchange={remove} /></label>
{/snippet}

{#if body}
  <section class="part" data-testid="poster-part" data-kind={kind}>
    <h3><span class="part-kind">{PART_KIND_LABEL[kind]}</span>{partLabel(doc, clip, part)}</h3>
    {@render body()}
  </section>
{/if}

<style>
  .part {
    display: grid;
    gap: 6px;
    padding: var(--ui-space-3) var(--ui-space-4) var(--ui-space-4);
    border-bottom: 1px solid var(--ui-line);
  }

  .part-kind {
    margin-right: 6px;
    color: var(--ui-ink-3);
    font-weight: 400;
  }

  input[type='text'],
  select {
    width: 100%;
    height: 28px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-ink);
    font: inherit;
  }

  input[type='text']:focus,
  select:focus {
    outline: none;
    border-color: var(--ui-accent);
  }


  h3 {
    margin: 0;
    font-size: var(--ui-text-xs);
    font-weight: 600;
  }


  .delete {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    justify-self: start;
  }

  button {
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  button:hover {
    background: var(--ui-hover);
  }

  .assets {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }

  .asset {
    aspect-ratio: 1;
    padding: 2px;
    overflow: hidden;
  }

  .asset img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .asset.on {
    outline: 2px solid var(--ui-accent);
    outline-offset: 1px;
  }

  .empty {
    grid-column: 1 / -1;
    font-size: var(--ui-text-sm, 11px);
    color: var(--ui-muted);
  }

  .field {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-2);
  }

  .field span {
    flex-shrink: 0;
    width: 88px;
  }
</style>
