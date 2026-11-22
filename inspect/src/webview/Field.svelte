<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { MIXED, type Shared } from '@feega/properties-panel/mixed';
  import { heldValue, liveNumber, type Held } from './scrub';
  import { typedCommit } from './typed-commit';
  import { Unit, convert, cssOf, isKeyword, keywordOf, parseLength, stepOf, type UnitContext } from './units';

  type Props = {
    name: string;
    prefix?: string;
    icon?: Snippet;
    px: Shared<number>;
    units?: Unit[];
    unit?: string;
    css?: string;
    context?: UnitContext;
    min?: number;
    max?: number;
    title?: string;
    override?: string;
    onchange: (value: string) => void;
    onpreview?: (value: string) => void;
  };

  let { name, prefix = '', icon, px, units, unit = '', css = '', context, min = -100000, max = 100000, title, override = '', onchange, onpreview = () => undefined }: Props = $props();

  const COARSE = 10;
  const DRAG_PX_PER_STEP = 2;
  const DECIMALS = 3;

  let picked = $state<Unit | null>(null);
  let scrub = $state<{ x: number; start: number } | null>(null);
  let draft = $state<number | null>(null);
  let held = $state<Held | null>(null);

  const chosen = $derived(picked ?? keywordOf(css, units) ?? Unit.Px);
  $effect(() => {
    const keyword = keywordOf(css, units);
    untrack(() => {
      if (keyword !== null || (css && picked !== null && isKeyword(picked))) {
        picked = null;
      }
    });
  });

  const lengthy = $derived(Boolean(units?.length));
  const step = $derived(lengthy ? stepOf(chosen) : 1);
  const shown = $derived.by(() => {
    if (draft !== null) {
      return draft;
    }
    const kept = held && px !== MIXED ? heldValue(held, px, Date.now()) : null;
    if (kept !== null) {
      return kept;
    }
    if (px === MIXED || !lengthy || !context || isKeyword(chosen)) {
      return px;
    }
    return convert({ value: px, unit: Unit.Px }, chosen, context).value;
  });
  const text = $derived(shown === MIXED || isKeyword(chosen) ? '' : String(Number((shown as number).toFixed(DECIMALS))));

  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const written = (v: number) => (lengthy ? cssOf({ value: clamp(v), unit: chosen }) : String(clamp(v)));
  const emit = (v: number) => onchange(written(v));
  const live = liveNumber({
    preview: (v) => onpreview(v),
    commit: (v) => onchange(v),
    frame: (run) => requestAnimationFrame(run),
    later: (run, ms) => {
      const id = setTimeout(run, ms);
      return () => clearTimeout(id);
    }
  });
  const hold = (v: number) => (held = { value: lengthy && context && chosen !== Unit.Px && !isKeyword(chosen) ? convert({ value: v, unit: chosen }, Unit.Px, context).value : v, since: Date.now() });

  function commitText(raw: string) {
    if (lengthy) {
      const parsed = parseLength(raw, isKeyword(chosen) ? Unit.Px : chosen);
      if (!parsed) {
        return;
      }
      picked = parsed.unit;
      onchange(cssOf({ ...parsed, value: clamp(parsed.value) }));
      return;
    }
    const n = parseFloat(raw);
    if (Number.isFinite(n)) {
      emit(n);
    }
  }

  const typed = typedCommit(commitText);

  function pickUnit(next: Unit) {
    picked = next;
    if (isKeyword(next)) {
      onchange(next);
    }
  }

  function onKey(e: KeyboardEvent) {
    const input = e.currentTarget as HTMLInputElement;
    if (e.key === 'Enter') {
      typed.commit(input.value);
      input.blur();
      return;
    }
    const dir = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
    if (dir && shown !== MIXED) {
      e.preventDefault();
      const next = clamp(Number(((shown as number) + dir * step * (e.shiftKey ? COARSE : 1)).toFixed(DECIMALS)));
      draft = next;
      live.nudge(written(next));
      hold(next);
      draft = null;
    }
  }

  function grab(e: PointerEvent) {
    if (shown === MIXED) {
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    scrub = { x: e.clientX, start: shown as number };
  }

  function drag(e: PointerEvent) {
    if (scrub) {
      const steps = Math.round((e.clientX - scrub.x) / DRAG_PX_PER_STEP);
      draft = clamp(Number((scrub.start + steps * step * (e.shiftKey ? COARSE : 1)).toFixed(DECIMALS)));
      live.move(written(draft));
    }
  }

  function drop() {
    if (scrub && draft !== null) {
      live.release(written(draft));
      hold(draft);
    }
    scrub = null;
    draft = null;
  }
</script>

<label class="field" class:scrubbing={scrub} data-field={name} {title}>
  <span class="prefix" role="presentation" onpointerdown={grab} onpointermove={drag} onpointerup={drop} onlostpointercapture={drop}>
    {#if icon}{@render icon()}{:else}{prefix}{/if}
  </span>
  <input class="value" type="text" inputmode="decimal" aria-label={name} value={text} placeholder={px === MIXED ? 'Mixed' : ''} onkeydown={onKey} onfocus={typed.focus} onchange={(e) => typed.commit(e.currentTarget.value)} />
  {#if lengthy}
    <select class="unit" class:keyword={isKeyword(chosen)} value={chosen} aria-label={`${name} unit`} onchange={(e) => pickUnit(e.currentTarget.value as Unit)}>
      {#each units! as u (u)}<option value={u}>{u || '–'}</option>{/each}
    </select>
  {:else if unit}
    <span class="unit-text">{unit}</span>
  {/if}
  {#if override}<span class="override-dot" title={override} aria-label={override} data-override></span>{/if}
</label>

<style>
  .override-dot {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 6px;
    height: 6px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-accent);
  }

  .field {
    display: flex;
    align-items: center;
    position: relative;
    min-width: 0;
    height: 28px;
    padding: 0 6px 0 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    box-shadow: none;
    cursor: text;
  }

  .field:hover {
    box-shadow: inset 0 0 0 1px var(--ui-field-border);
  }

  .field:focus-within {
    box-shadow: inset 0 0 0 1px var(--ui-accent);
  }

  .prefix {
    display: grid;
    place-items: center;
    flex: none;
    min-width: 20px;
    height: 100%;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
    cursor: ew-resize;
    user-select: none;
  }

  .value {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: 0;
    background: none;
    box-shadow: none !important;
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-sm);
    font-variant-numeric: tabular-nums;
    outline: none;
  }

  .unit,
  .unit-text {
    flex: none;
    max-width: 34px;
    padding: 0;
    border: 0;
    background: none;
    box-shadow: none !important;
    color: var(--ui-text-3);
    font: inherit;
    font-size: var(--ui-text-xs);
    text-align: right;
    appearance: none;
    cursor: pointer;
  }

  .unit.keyword {
    max-width: 96px;
    color: var(--ui-text);
  }

  .unit:hover {
    color: var(--ui-text);
  }

  .scrubbing,
  .scrubbing .prefix {
    cursor: ew-resize;
  }
</style>
