<script lang="ts">
  import { EASE_IDS, EASE_LABEL } from '$lib/motion/design';
  import type { Bezier, EaseSpec } from '$lib/motion/keyframes';
  import { easePath } from '$lib/motion/timeline-view';
  import { parseDecimal } from '$lib/motion/inspector';

  const CURVE_PX = 28;
  const PREVIEW_PX = 64;
  const DEFAULT_BEZIER: Bezier = [0.25, 0.1, 0.25, 1];

  let { ease, onpick, onclose }: { ease: EaseSpec; onpick: (ease: EaseSpec) => void; onclose: () => void } = $props();

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
    background: var(--paper);
    border: 1px solid var(--line);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    font-size: 11px;
  }

  path {
    fill: none;
    stroke: #a855f7;
    stroke-width: 1.5;
  }

  .preview {
    align-self: center;
    background: var(--paper-2);
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
    border: 1px solid var(--line);
    font-size: 8px;
  }

  .named svg {
    overflow: visible;
  }

  .named button.on {
    outline: 2px solid #a855f7;
    outline-offset: -1px;
  }

  .bezier {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .bezier span {
    font-family: 'Fragment Mono', ui-monospace, monospace;
    color: var(--ink-soft);
  }

  .bezier input {
    width: 34px;
    padding: 2px;
    border: 1px solid var(--line);
    background: var(--paper);
    color: var(--ink);
    font: inherit;
  }

  .close {
    align-self: flex-end;
    padding: 2px 8px;
    border: 1px solid var(--line);
  }
</style>
