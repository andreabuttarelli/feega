<script lang="ts">
  import { FIELD_INPUT, Field, Section } from '$lib/components/ui/shell';
  import { cn } from '$lib/utils.js';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import type { OpResult } from '$lib/motion/timeline';
  import { StyleKind, applyStyle, detachStyle, saveAsStyle, stylesFor } from '$lib/motion/styles';

  let { doc, clip, commit }: { doc: MotionDoc; clip: MotionClip; commit: (result: OpResult, summary: string) => void } = $props();

  const NONE = '';

  const offered = $derived(stylesFor(doc, clip.component));
  let name = $state('');

  function pick(value: string) {
    if (value === NONE) {
      commit(detachStyle(doc, [clip.id]), 'Detached the style');
      return;
    }
    commit(applyStyle(doc, [clip.id], value), `Applied the ${value} style`);
  }

  function save(kind: StyleKind) {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    commit(saveAsStyle(doc, clip.id, trimmed, kind), `Saved the ${trimmed} style`);
    name = '';
  }
</script>

<Section title="Style">
  <Field label="Style" id="clip-style">
    <select id="clip-style" class={cn(FIELD_INPUT, 'w-full')} data-testid="clip-style" value={clip.styleRef ?? NONE} onchange={(e) => pick(e.currentTarget.value)}>
      <option value={NONE}>None</option>
      {#each offered as s (s.name)}<option value={s.name}>{s.name}</option>{/each}
    </select>
  </Field>
  <Field label="New style" id="clip-style-name">
    <input id="clip-style-name" class={cn(FIELD_INPUT, 'w-full')} type="text" placeholder="Name" bind:value={name} data-testid="clip-style-name" />
  </Field>
  <div class="flex gap-2">
    {#if 'font' in clip.props}<button type="button" class={cn(FIELD_INPUT, 'flex-1')} onclick={() => save(StyleKind.Text)}>Save text style</button>{/if}
    <button type="button" class={cn(FIELD_INPUT, 'flex-1')} onclick={() => save(StyleKind.Colour)}>Save colour style</button>
  </div>
</Section>
