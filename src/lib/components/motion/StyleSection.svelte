<script lang="ts">
  import { FIELD_INPUT, Field, Section } from '$lib/components/ui/shell';
  import { cn } from '$lib/utils.js';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import type { OpResult } from '$lib/motion/timeline';
  import { StyleKind, StyleSlot, applyStyle, detachStyle, saveAsStyle, slotOf } from '$lib/motion/styles';
  import { adoptStyle, offeredStyles } from '$lib/motion/style-library';
  import { FILLED } from '$lib/motion/fill/elements';
  import { styleLibrary } from '$lib/canvas/style-library.svelte';

  let { doc, clip, commit }: { doc: MotionDoc; clip: MotionClip; commit: (result: OpResult, summary: string) => void } = $props();

  const NONE = '';

  const offered = $derived(offeredStyles(doc, clip.component, styleLibrary.styles));
  const offeredIn = (slot: StyleSlot) => offered.filter((s) => slotOf(s.style.kind) === slot);
  const linkedStyles = $derived([clip.styleRef, clip.effectStyleRef].flatMap((name) => (name && doc.styles?.[name] ? [{ name, kind: doc.styles[name].kind }] : [])));
  let name = $state('');

  function pick(slot: StyleSlot, value: string) {
    if (value === NONE) {
      commit(detachStyle(doc, [clip.id], slot), 'Detached the style');
      return;
    }
    const shared = offered.find((s) => s.name === value && s.shared);
    commit(shared ? adoptStyle(doc, [clip.id], value, shared.style) : applyStyle(doc, [clip.id], value), `Applied the ${value} style`);
  }

  function save(styleName: string, kind: StyleKind) {
    const trimmed = styleName.trim();
    if (!trimmed) {
      return;
    }
    const saved = saveAsStyle(doc, clip.id, trimmed, kind);
    commit(saved, `Saved the ${trimmed} style`);
    const style = saved.ok ? saved.doc.styles?.[trimmed] : undefined;
    if (style) {
      styleLibrary.push(trimmed, style);
    }
  }

  function saveNew(kind: StyleKind) {
    save(name, kind);
    name = '';
  }
</script>

<Section title="Style">
  {@render picker('Style', 'clip-style', StyleSlot.Look, clip.styleRef)}
  {#if clip.component in FILLED || clip.effects.length || offeredIn(StyleSlot.Effect).length || clip.effectStyleRef}
    {@render picker('Effect style', 'clip-effect-style', StyleSlot.Effect, clip.effectStyleRef)}
  {/if}
  {#each linkedStyles as linked (linked.name)}
    <button type="button" class={cn(FIELD_INPUT, 'w-full')} data-testid="style-update" data-style={linked.name} onclick={() => save(linked.name, linked.kind)}>Update {linked.name} from this clip</button>
  {/each}
  <Field label="New style" id="clip-style-name">
    <input id="clip-style-name" class={cn(FIELD_INPUT, 'w-full')} type="text" placeholder="Name" bind:value={name} data-testid="clip-style-name" />
  </Field>
  <div class="flex flex-wrap gap-2">
    {#if 'font' in clip.props}<button type="button" class={cn(FIELD_INPUT, 'flex-1')} onclick={() => saveNew(StyleKind.Text)}>Save text style</button>{/if}
    <button type="button" class={cn(FIELD_INPUT, 'flex-1')} onclick={() => saveNew(StyleKind.Colour)}>Save colour style</button>
    {#if clip.component in FILLED}<button type="button" class={cn(FIELD_INPUT, 'flex-1')} data-testid="style-save-paint" onclick={() => saveNew(StyleKind.Paint)}>Save fill style</button>{/if}
    {#if clip.effects.length}<button type="button" class={cn(FIELD_INPUT, 'flex-1')} data-testid="style-save-effect" onclick={() => saveNew(StyleKind.Effect)}>Save effect style</button>{/if}
  </div>
</Section>

{#snippet picker(label: string, id: string, slot: StyleSlot, current: string | undefined)}
  <Field {label} {id}>
    <select {id} class={cn(FIELD_INPUT, 'w-full')} data-testid={id} value={current ?? NONE} onchange={(e) => pick(slot, e.currentTarget.value)}>
      <option value={NONE}>None</option>
      {#each offeredIn(slot) as s (s.name)}<option value={s.name}>{s.name}{s.shared ? ' · canvas' : ''}</option>{/each}
    </select>
  </Field>
{/snippet}
