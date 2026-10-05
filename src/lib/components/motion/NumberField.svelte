<script lang="ts">
  import { parseDecimal } from '$lib/motion/inspector';
  import { KeyMark } from '$lib/motion/timeline-layers';
  import { FieldFill, FieldKind, Nudge, fillShare, formatValue, nudged, precisionOf, scrubbed, type Range } from '$lib/motion/number-field';

  let {
    label,
    name,
    value,
    range,
    unit = '',
    fill = FieldFill.None,
    kind = FieldKind.Glyph,
    mark = null,
    expression = false,
    disabled = false,
    onchange,
    onkey,
    onexpression
  }: {
    label: string;
    name: string;
    value: number;
    range: Range;
    unit?: string;
    fill?: FieldFill;
    kind?: FieldKind;
    mark?: KeyMark | null;
    expression?: boolean;
    disabled?: boolean;
    onchange: (value: number) => void;
    onkey?: () => void;
    onexpression?: () => void;
  } = $props();

  const NUDGE_KEYS: Record<string, Nudge> = { ArrowUp: Nudge.Up, ArrowDown: Nudge.Down };

  let input = $state<HTMLInputElement | null>(null);
  let scrub: { x: number; start: number } | null = null;

  function startScrub(e: PointerEvent) {
    if (disabled || e.button !== 0) {
      return;
    }
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    scrub = { x: e.clientX, start: value };
  }

  function moveScrub(e: PointerEvent) {
    if (!scrub) {
      return;
    }
    const next = scrubbed(scrub.start, e.clientX - scrub.x, range, precisionOf(e));
    if (next !== value) {
      onchange(next);
    }
  }

  function commit(text: string) {
    const parsed = parseDecimal(text);
    if (parsed === null) {
      input!.value = formatValue(value, range.step);
      return;
    }
    onchange(Math.min(range.max, Math.max(range.min, parsed)));
  }

  function onKeydown(e: KeyboardEvent) {
    const direction = NUDGE_KEYS[e.key];
    if (direction) {
      e.preventDefault();
      onchange(nudged(value, direction, precisionOf(e), range));
      return;
    }
    if (e.key === 'Enter') {
      input?.blur();
      return;
    }
    if (e.key === 'Escape') {
      input!.value = formatValue(value, range.step);
      input?.blur();
    }
  }

  function onContext(e: MouseEvent) {
    if (!onexpression) {
      return;
    }
    e.preventDefault();
    onexpression();
  }
</script>

<div class="field {kind}" class:disabled class:expression data-field={name} style={fill === FieldFill.Range ? `--fill: ${fillShare(value, range) * 100}%;` : ''} oncontextmenu={onContext} role="group" aria-label={name}>
  <span class="label" title={`${name} · drag to scrub (Shift ×10, Alt ×0.1)`} onpointerdown={startScrub} onpointermove={moveScrub} onpointerup={() => (scrub = null)} onlostpointercapture={() => (scrub = null)} aria-hidden="true">{label}</span>
  <input bind:this={input} class="num" type="text" inputmode="decimal" aria-label={name} {disabled} value={formatValue(value, range.step)} onchange={(e) => commit(e.currentTarget.value)} onkeydown={onKeydown} />
  {#if unit}<span class="unit" aria-hidden="true">{unit}</span>{/if}
  {#if mark}
    <button type="button" class="mark" data-mark={mark} title={mark === KeyMark.Here ? 'Remove the keyframe here' : 'Add a keyframe here'} aria-label={`Keyframe ${name}`} aria-pressed={mark === KeyMark.Here} {disabled} onclick={onkey}></button>
  {/if}
</div>

<style>
  .field {
    position: relative;
    display: flex;
    align-items: center;
    height: 24px;
    min-width: 0;
    background: var(--ui-surface);
    border: 1px solid transparent;
  }

  .field::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: var(--fill, 0);
    background: var(--ui-accent-wash);
    pointer-events: none;
  }

  .field:hover {
    border-color: var(--ui-line-strong);
  }

  .field:focus-within {
    border-color: var(--ui-accent);
  }

  .field.disabled {
    color: var(--ui-ink-3);
  }

  .label {
    position: relative;
    flex-shrink: 0;
    width: 22px;
    text-align: center;
    font-family: var(--ui-mono);
    font-size: 10px;
    color: var(--ui-ink-3);
    cursor: ew-resize;
    touch-action: none;
    white-space: nowrap;
    overflow: hidden;
  }

  .named .label {
    width: 84px;
    padding-left: 6px;
    text-align: left;
    font-family: inherit;
    font-size: 11px;
    color: var(--ui-ink-2);
    text-overflow: ellipsis;
  }

  .label:hover {
    color: var(--ui-ink);
  }

  .num {
    position: relative;
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0 2px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--ui-ink);
    font-family: var(--ui-mono);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    outline: none;
  }

  .expression .num {
    color: var(--ui-accent);
  }

  .num:disabled {
    color: var(--ui-ink-3);
  }

  .unit {
    position: relative;
    flex-shrink: 0;
    padding-right: 4px;
    font-size: 10px;
    color: var(--ui-ink-3);
  }

  .mark {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 18px;
    height: 22px;
    border: 0;
    border-radius: 0;
    background: none;
    cursor: pointer;
  }

  .mark::before {
    content: '';
    width: 7px;
    height: 7px;
    transform: rotate(45deg);
    border: 1.5px solid var(--ui-ink-3);
  }

  .mark:hover::before {
    border-color: var(--ui-ink);
  }

  .mark[data-mark='here']::before {
    border-color: var(--ui-accent);
    background: var(--ui-accent);
  }

  .mark[data-mark='animated']::before {
    border-color: var(--ui-accent);
    background: linear-gradient(135deg, var(--ui-accent) 50%, transparent 50%);
  }
</style>
