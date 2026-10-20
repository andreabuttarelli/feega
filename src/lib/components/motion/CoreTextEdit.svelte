<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { MotionDoc } from '$lib/motion/doc';
  import { apply2d, invert2d } from '$lib/motion/parent';
  import type { TextCaret } from '$lib/motion/gpu-full/display-list';
  import type { CaretSource } from '$lib/canvas/core/text-caret';
  import { CLICK_GRAINS, Grain, Step, caretRect, charUnder, codePointsOf, dragged, hitTest, lineEdge, nextLine, pressed, selectionBoxes, unitsOf, type Pick } from '$lib/motion/gpu-full/text/caret';

  type Pt = [number, number];

  let {
    doc,
    clipId,
    text,
    first,
    caret,
    at = null,
    ontype,
    onend
  }: {
    doc: MotionDoc;
    clipId: string;
    text: string;
    first: TextCaret;
    caret: CaretSource;
    at?: Pt | null;
    ontype: (text: string) => void;
    onend: (text: string | null) => void;
  } = $props();

  const MULTI_CLICK_MS = 450;
  const MULTI_CLICK_PX = 6;
  const HIT_PAD_EM = 0.5;
  const KEY_ESCAPE = 'Escape';
  const KEY_ENTER = 'Enter';

  let input = $state<HTMLTextAreaElement | null>(null);
  let metrics = $state<TextCaret>(untrack(() => first));
  let value = $state(untrack(() => text));
  let pick = $state<Pick>({ anchor: 0, focus: 0 });
  let focused = $state(false);
  let composing = $state<[number, number] | null>(null);
  let keepFocus = false;
  let goalX: number | null = null;
  let turn = 0;
  let grain = Grain.Char;
  let base: Pick = { anchor: 0, focus: 0 };
  let dragging = false;
  let lastDown = { time: 0, at: [0, 0] as Pt, clicks: 0 };
  let finished = false;
  const CARET_PX = 1.5;

  const lines = $derived(metrics.lines);
  const toDoc = (x: number, y: number): Pt => apply2d(metrics.matrix, [x, y]);
  const toText = (p: Pt): Pt => apply2d(invert2d(metrics.matrix), p);
  const points = (box: { left: number; right: number; top: number; height: number }) => [toDoc(box.left, box.top), toDoc(box.right, box.top), toDoc(box.right, box.top + box.height), toDoc(box.left, box.top + box.height)];
  const polygon = (quad: Pt[]) => quad.map((p) => p.join(',')).join(' ');

  const selection = $derived(selectionBoxes(lines, pick.anchor, pick.focus).map((b) => polygon(points(b))));
  const marked = $derived(composing ? selectionBoxes(lines, composing[0], composing[1]).map((b) => points(b)) : []);
  const place = $derived(caretRect(lines, pick.focus));
  const tip = $derived([toDoc(place.x, place.top), toDoc(place.x, place.top + place.height)]);
  const bounds = $derived.by(() => {
    const xs = lines.flatMap((l) => l.stops.map((s) => s.x));
    const pad = (lines[0]?.height ?? 0) * HIT_PAD_EM;
    const last = lines.at(-1);
    return { left: Math.min(...xs) - pad, right: Math.max(...xs) + pad, top: (lines[0]?.top ?? 0) - pad, bottom: (last ? last.top + last.height : 0) + pad };
  });

  $effect(() => {
    const d = doc;
    const id = ++turn;
    void caret(d, clipId).then((m) => {
      if (id === turn && m) {
        metrics = m;
      }
    });
  });

  onMount(() => {
    input?.focus({ preventScroll: true });
    if (at) {
      const [x, y] = toText(at);
      write(pressed(Grain.Char, value, lines, hitTest(lines, x, y)));
      return;
    }
    write({ anchor: 0, focus: codePointsOf(value, value.length) });
  });

  function read() {
    if (!input) {
      return;
    }
    const from = codePointsOf(input.value, input.selectionStart);
    const to = codePointsOf(input.value, input.selectionEnd);
    pick = input.selectionDirection === 'backward' ? { anchor: to, focus: from } : { anchor: from, focus: to };
  }

  function write(next: Pick) {
    pick = next;
    if (!input) {
      return;
    }
    const a = unitsOf(input.value, Math.min(next.anchor, next.focus));
    const b = unitsOf(input.value, Math.max(next.anchor, next.focus));
    input.setSelectionRange(a, b, next.focus < next.anchor ? 'backward' : 'forward');
  }

  function finish(commit: boolean) {
    if (finished) {
      return;
    }
    finished = true;
    onend(commit ? (input?.value ?? value) : null);
  }

  function oninput(e: Event) {
    const area = e.currentTarget as HTMLTextAreaElement;
    value = area.value;
    goalX = null;
    ontype(area.value);
    read();
  }

  function onselect() {
    read();
  }

  function oncompositionstart() {
    const at = input?.selectionStart ?? 0;
    composing = [codePointsOf(value, at), codePointsOf(value, at)];
  }

  function oncompositionupdate(e: CompositionEvent) {
    if (!composing) {
      return;
    }
    composing = [composing[0], composing[0] + [...e.data].length];
  }

  function oncompositionend() {
    composing = null;
    read();
  }

  function vertical(e: KeyboardEvent, step: Step) {
    e.preventDefault();
    goalX ??= place.x;
    const focus = nextLine(lines, pick.focus, step, goalX);
    write({ anchor: e.shiftKey ? pick.anchor : focus, focus });
  }

  function edge(e: KeyboardEvent, step: Step) {
    e.preventDefault();
    const focus = lineEdge(lines, pick.focus, step);
    write({ anchor: e.shiftKey ? pick.anchor : focus, focus });
  }

  const EDGE_KEYS: Record<string, Step> = { Home: Step.Back, End: Step.Forward };
  const META_EDGE_KEYS: Record<string, Step> = { ArrowLeft: Step.Back, ArrowRight: Step.Forward };
  const VERTICAL_KEYS: Record<string, Step> = { ArrowUp: Step.Back, ArrowDown: Step.Forward };

  function onkeydown(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.isComposing) {
      return;
    }
    if (e.key === KEY_ESCAPE) {
      e.preventDefault();
      finish(true);
      return;
    }
    if (e.key === KEY_ENTER && !e.shiftKey) {
      e.preventDefault();
      finish(true);
      return;
    }
    if (e.key in VERTICAL_KEYS && !e.altKey && !e.metaKey && !e.ctrlKey) {
      vertical(e, VERTICAL_KEYS[e.key]);
      return;
    }
    if (e.key in EDGE_KEYS || (e.metaKey && e.key in META_EDGE_KEYS)) {
      edge(e, EDGE_KEYS[e.key] ?? META_EDGE_KEYS[e.key]);
      return;
    }
    goalX = null;
  }

  function onkeyup() {
    read();
  }

  function onblur() {
    if (keepFocus) {
      input?.focus({ preventScroll: true });
      return;
    }
    focused = false;
    finish(true);
  }

  const offsetAt = (x: number, y: number) => (grain === Grain.Char ? hitTest(lines, x, y) : charUnder(lines, x, y));

  function inside(p: Pt): boolean {
    const [x, y] = toText(p);
    return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
  }

  function counted(e: PointerEvent, p: Pt): number {
    const near = Math.hypot(p[0] - lastDown.at[0], p[1] - lastDown.at[1]) <= MULTI_CLICK_PX;
    const clicks = near && e.timeStamp - lastDown.time <= MULTI_CLICK_MS ? lastDown.clicks + 1 : 1;
    lastDown = { time: e.timeStamp, at: p, clicks };
    return clicks;
  }

  export function down(e: PointerEvent, p: Pt): boolean {
    if (!inside(p)) {
      finish(true);
      return false;
    }
    keepFocus = true;
    input?.focus({ preventScroll: true });
    const [x, y] = toText(p);
    grain = CLICK_GRAINS[(counted(e, p) - 1) % CLICK_GRAINS.length];
    const offset = offsetAt(x, y);
    const chosen = pressed(grain, value, lines, offset);
    base = e.shiftKey && grain === Grain.Char ? { anchor: pick.anchor, focus: pick.anchor } : chosen;
    write(e.shiftKey && grain === Grain.Char ? { anchor: pick.anchor, focus: offset } : chosen);
    goalX = null;
    dragging = true;
    return true;
  }

  export function drag(p: Pt) {
    if (!dragging) {
      return;
    }
    const [x, y] = toText(p);
    write(dragged(grain, value, lines, base, offsetAt(x, y)));
  }

  export function release(): boolean {
    const was = dragging;
    dragging = false;
    keepFocus = false;
    return was;
  }

  export const active = () => dragging;
  export const stop = () => finish(true);

</script>

<svg viewBox={`0 0 ${doc.width} ${doc.height}`} preserveAspectRatio="none" aria-hidden="true" data-testid="core-text-edit">
  {#each selection as shape, i (i)}
    <polygon class="selection" points={shape} data-testid="core-selection" />
  {/each}
  {#each marked as quad, i (i)}
    <line class="mark" x1={quad[3][0]} y1={quad[3][1]} x2={quad[2][0]} y2={quad[2][1]} data-testid="core-composition" />
  {/each}
  {#if focused && pick.anchor === pick.focus}
    {#key `${pick.focus}:${value}`}
      <line class="caret" x1={tip[0][0]} y1={tip[0][1]} x2={tip[1][0]} y2={tip[1][1]} style:stroke-width={`${CARET_PX}px`} data-testid="core-caret" />
    {/key}
  {/if}
</svg>

<textarea
  bind:this={input}
  class="sink"
  aria-label="Edit text"
  data-testid="core-text-input"
  wrap="off"
  spellcheck="false"
  autocomplete="off"
  value={value}
  style:left={`${(tip[0][0] / doc.width) * 100}%`}
  style:top={`${(tip[0][1] / doc.height) * 100}%`}
  {oninput}
  {onselect}
  {onkeydown}
  {onkeyup}
  {onblur}
  onfocus={() => (focused = true)}
  {oncompositionstart}
  {oncompositionupdate}
  {oncompositionend}
  onpointerdown={(e) => e.stopPropagation()}
></textarea>

<style>
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }

  .selection {
    fill: color-mix(in srgb, var(--ui-accent) 28%, transparent);
    stroke: none;
  }

  .caret,
  .mark {
    stroke: var(--ui-accent);
    vector-effect: non-scaling-stroke;
    animation: blink 1.06s steps(1) infinite;
  }

  .mark {
    animation: none;
    stroke-width: 1.5px;
  }

  @media (prefers-reduced-motion: reduce) {
    .caret {
      animation: none;
    }
  }

  .sink {
    position: absolute;
    width: 2px;
    height: 1em;
    margin: 0;
    padding: 0;
    border: 0;
    outline: none;
    resize: none;
    overflow: hidden;
    opacity: 0;
    white-space: pre;
    font-size: 16px;
    pointer-events: none;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
</style>
