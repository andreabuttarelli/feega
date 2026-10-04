<script lang="ts">
  import { EASE_IDS, EASE_LABEL } from '$lib/motion/design';
  import { INTERPS, INTERP_LABEL, Interp, type Bezier, type EaseSpec } from '$lib/motion/keyframes';
  import { KeySide, easePath } from '$lib/motion/timeline-view';
  import { parseDecimal } from '$lib/motion/inspector';

  const CURVE_PX = 28;
  const PREVIEW_PX = 64;
  const DEFAULT_BEZIER: Bezier = [0.25, 0.1, 0.25, 1];

  const SIDE_LABEL: Record<KeySide, string> = { [KeySide.Out]: 'Leaving', [KeySide.In]: 'Entering next' };

  let {
    ease,
    kinds = { [KeySide.Out]: Interp.Bezier, [KeySide.In]: Interp.Bezier },
    onpick,
    onkind,
    onclose
  }: { ease: EaseSpec; kinds?: Record<KeySide, Interp>; onpick: (ease: EaseSpec) => void; onkind?: (side: KeySide, kind: Interp) => void; onclose: () => void } = $props();

  const bezier = $derived<Bezier>(typeof ease === 'string' ? DEFAULT_BEZIER : ease);

  function setPoint(index: number, text: string) {
    const parsed = parseDecimal(text);
    if (parsed === null) {
      return;
    }
    const next = [...bezier] as Bezier;
    next[index] = index % 2 === 0 ? Math.min(1, Math.max(0, parsed)) : parsed;
    onpick(next);
  }
</script>

<div class="picker" role="dialog" aria-label="Ease" data-testid="ease-picker">
  <svg class="preview" width={PREVIEW_PX} height={PREVIEW_PX} viewBox={`-2 -2 ${PREVIEW_PX + 4} ${PREVIEW_PX + 4}`}>
    <path d={easePath(ease, PREVIEW_PX)} />
  </svg>
  <div class="named">
    {#each EASE_IDS as id (id)}
      <button type="button" class:on={ease === id} title={EASE_LABEL[id]} onclick={() => onpick(id)}>
        <svg width={CURVE_PX} height={CURVE_PX} viewBox={`-1 -1 ${CURVE_PX + 2} ${CURVE_PX + 2}`}><path d={easePath(id, CURVE_PX)} /></svg>
        <span>{EASE_LABEL[id]}</span>
      </button>
    {/each}
  </div>
  {#if onkind}
    {#each Object.values(KeySide) as side (side)}
      <div class="kinds" role="group" aria-label={SIDE_LABEL[side]} data-key-side={side}>
        <span>{SIDE_LABEL[side]}</span>
        {#each INTERPS as kind (kind)}
          <button type="button" class:on={kinds[side] === kind} aria-pressed={kinds[side] === kind} onclick={() => onkind(side, kind)}>{INTERP_LABEL[kind]}</button>
        {/each}
      </div>
    {/each}
  {/if}
  <div class="bezier">
    <span>cubic-bezier</span>
    {#each bezier as point, i (i)}
      <input type="text" inputmode="decimal" aria-label={`Bezier ${i + 1}`} value={String(point)} onchange={(e) => setPoint(i, e.currentTarget.value)} />
    {/each}
  </div>
  <button type="button" class="close" onclick={onclose}>Done</button>
</div>

<style>
  .picker {
    position: absolute;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 240px;
    padding: 8px;
    background: var(--ui-bg);
    border: 1px solid var(--ui-line);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    font-size: 11px;
  }

  path {
    fill: none;
    stroke: var(--ui-accent);
    stroke-width: 1.5;
  }

  .preview {
    align-self: center;
    background: var(--ui-surface);
    overflow: visible;
  }

  .named {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 3px;
  }

  .named button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 3px 0;
    border: 1px solid var(--ui-line);
    font-size: 8px;
  }

  .named svg {
    overflow: visible;
  }

  .named button.on {
    outline: 2px solid var(--ui-accent);
    outline-offset: -1px;
  }

  .kinds {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 3px;
  }

  .kinds span {
    width: 100%;
    font-family: var(--ui-mono);
    color: var(--ui-ink-2);
  }

  .kinds button {
    padding: 1px 4px;
    border: 1px solid var(--ui-line);
    font-size: 9px;
  }

  .kinds button.on {
    background: var(--ui-accent-wash);
    border-color: var(--ui-accent);
    color: var(--ui-accent);
  }

  .bezier {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .bezier span {
    font-family: var(--ui-mono);
    color: var(--ui-ink-2);
  }

  .bezier input {
    width: 34px;
    padding: 2px;
    border: 1px solid var(--ui-line);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
  }

  .close {
    align-self: flex-end;
    padding: 2px 8px;
    border: 1px solid var(--ui-line);
  }
</style>
