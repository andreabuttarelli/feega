<script lang="ts">
  import type { Snippet } from 'svelte';
  import { clipsOf, type MotionClip, type MotionDoc } from '$lib/motion/doc';
  import { Source, type AnimProp } from '$lib/motion/keyframes';
  import type { OpResult } from '$lib/motion/timeline';
  import { PATH_PRESETS, PathSourceKind, type PathSource } from '$lib/motion/text-path/model';
  import { SHAPE_SOURCE, removeTextPath, setTextPath } from '$lib/motion/text-path/ops';

  let { doc, clip, params, row, commit }: { doc: MotionDoc; clip: MotionClip; params: readonly AnimProp[]; row: Snippet<[AnimProp]>; commit: (result: OpResult, summary: string) => void } = $props();

  const NONE = 'none';
  const CLIP_PREFIX = 'clip:';

  const shapes = $derived(clipsOf(doc).filter((c) => c.component === SHAPE_SOURCE));
  const rows = $derived(params.filter((p) => p.source === Source.TextPath));
  const current = $derived(valueOf(clip.textPath?.source ?? null));

  function valueOf(source: PathSource | null): string {
    if (!source) {
      return NONE;
    }
    return source.kind === PathSourceKind.Preset ? source.preset : `${CLIP_PREFIX}${source.clip}`;
  }

  function sourceOf(value: string): PathSource {
    return value.startsWith(CLIP_PREFIX) ? { kind: PathSourceKind.Clip, clip: value.slice(CLIP_PREFIX.length) } : { kind: PathSourceKind.Preset, preset: value as (typeof PATH_PRESETS)[number] };
  }

  function pick(value: string) {
    if (value === NONE) {
      commit(removeTextPath(doc, clip.id), 'Took the text off its path');
      return;
    }
    commit(setTextPath(doc, clip.id, { source: sourceOf(value) }), 'Put the text on a path');
  }
</script>

<section data-testid="text-path-section">
  <h4>Path</h4>
  <select aria-label="Text path" data-testid="text-path-source" value={current} onchange={(e) => pick(e.currentTarget.value)}>
    <option value={NONE}>None</option>
    {#each PATH_PRESETS as preset (preset)}<option value={preset}>{preset}</option>{/each}
    {#each shapes as shape (shape.id)}<option value={`${CLIP_PREFIX}${shape.id}`}>Shape {shape.id}</option>{/each}
  </select>
  {#each rows as prop (prop.key)}{@render row(prop)}{/each}
</section>
