<script lang="ts">
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import { BASE_BREAKPOINT, clearOverride, overrideLabel, overridesAt, stackOn, viewsOf } from '@feega/motion-core/motion/breakpoints/model';

  let { doc, clipId, active, onchange }: { doc: MotionDoc; clipId: string; active: string; onchange: (result: OpResult, summary: string) => void } = $props();

  const view = $derived(viewsOf(doc).find((v) => v.id === active));
  const keys = $derived(active === BASE_BREAKPOINT ? [] : overridesAt(doc, clipId, active));
  const container = $derived(doc.tracks.some((t) => t.clips.some((c) => c.id === clipId && c.autoLayout)));
</script>

{#if view && active !== BASE_BREAKPOINT}
  <div class="overrides" data-testid="breakpoint-overrides">
    <header>Editing {view.name} {view.width}</header>
    {#each keys as key (key)}
      <div class="row" data-testid="breakpoint-override">
        <span>{overrideLabel(key)} overridden in {view.name}</span>
        <button type="button" onclick={() => onchange({ ok: true, doc: clearOverride(doc, active, clipId, key) }, `Reset ${overrideLabel(key)} in ${view.name}`)}>Reset</button>
      </div>
    {/each}
    {#if container}
      <button type="button" class="stack" onclick={() => onchange(stackOn(doc, active, clipId), `Stacked on ${view.name}`)} data-testid="stack-on-breakpoint">Stack on this breakpoint</button>
    {/if}
  </div>
{/if}

<style>
  .overrides {
    display: grid;
    gap: 4px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--ui-line);
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-2);
  }

  header {
    color: var(--ui-ink);
    font-weight: 500;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
  }

  button {
    height: 24px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-ink);
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    background: var(--ui-hover);
  }

  .stack {
    justify-self: start;
  }
</style>
