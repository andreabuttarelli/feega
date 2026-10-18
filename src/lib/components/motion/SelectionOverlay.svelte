<script lang="ts">
  import { resizedTexts } from '$lib/motion/text-fit';
  import { textTarget } from '$lib/motion/hyperframes/text-edit';
  import { clipChrome } from '$lib/canvas/selection-chrome';
  import { onMount, untrack } from 'svelte';
  import { findClip, type MotionClip, type MotionDoc } from '$lib/motion/doc';
  import { DragPhase, isOutside, type ElementOut, type HostDrag, type HostMove, hostShift, hostTurn } from '$lib/canvas/canvas-drop';
  import type { MeasuredBox } from '$lib/motion/hyperframes/measure';
  import { selectionView } from '$lib/motion/selection-context';
  import { reorderAt } from '$lib/motion/layout/guides';
  import { measureGaps } from '$lib/motion/measure-gaps';
  import { withAutoLayout } from '$lib/motion/layout/resolve';
  import { guessedBoxes } from '$lib/motion/move-element';
  import type { ComponentId } from '$lib/motion/components';
  import type { Transform } from '$lib/motion/keyframes';
  import { CLIP_TEXT, PART_ACTIONS, PART_ACTION_LOOK, PART_SEP, PartAction, PartEdit, editablePart, partAt, partBoxes, partKind, partText, runPart, writePartText } from '$lib/motion/poster-parts';
  import { Depth, Gesture, drill, levelOf, type Level, type Probe } from '$lib/motion/drill';
  import { Grip, Modifier, aabb, pickModeAt, anchorOf, dragPatch, handlesOf, pick, quadOf, readout, remeasured, spacing, stackAt, writePatch, type Boxes, type Gap, type Guide, type Pt, type Quad } from '$lib/motion/scene-select';

  let {
    doc,
    frame,
    html,
    redraws,
    measure,
    onpreview,
    onchange,
    pickAt = null,
    ask = () => null,
    part = $bindable(null),
    onparts = () => {},
    onboxes = () => {},
    outlined = null,
    onhover = () => {},
    ondragout = null,
    onhostdrag = null,
    onmenu = null,
    edittext = null
  }: {
    doc: MotionDoc;
    frame: number;
    html: string;
    redraws: number;
    measure: () => Promise<Record<string, MeasuredBox>>;
    onpreview: (doc: MotionDoc | null) => void;
    onchange: (doc: MotionDoc, summary: string) => void;
    pickAt?: Pt | null;
    ask?: () => { at: Pt | null; gesture: Gesture; from: Depth } | null;
    part?: string | null;
    onparts?: (parts: Record<string, string[]>) => void;
    onboxes?: (boxes: Boxes) => void;
    outlined?: string | null;
    onhover?: (id: string | null) => void;
    ondragout?: ((out: ElementOut, phase: DragPhase) => void) | null;
    onhostdrag?: HostDrag | null;
    onmenu?: ((menu: { client: Pt; layers: string[] }) => void) | null;
    edittext?: ((selector: string, at: { x: number; y: number } | null) => Promise<string | null>) | null;
  } = $props();

  const shared = selectionView()!;
  const selection = $derived(shared.ids);
  const onselect = (ids: string[]) => shared.select(ids);

  const SNAP_SCREEN_PX = 8;
  const SETTLE_MS = 300;
  const EMPTY_RETRIES = 20;
  const ROTATE_REACH_PX = 44;

  const SUMMARY: Record<Grip, string> = {
    [Grip.Move]: 'Moved in the preview',
    [Grip.Scale]: 'Scaled in the preview',
    [Grip.Rotate]: 'Rotated in the preview',
    [Grip.Anchor]: 'Moved the anchor point'
  };

  const chrome = $derived(clipChrome(part));
  type Grab = { grip: Grip; handle: number; clipId: string; from: Pt; start: ClientPt; pointer: number };
  type ClientPt = { x: number; y: number };

  let host = $state<HTMLDivElement | null>(null);
  let boxes = $state<Boxes>(untrack(() => guessedBoxes(withAutoLayout(doc))));
  let hover = $state<string | null>(null);
  let grab = $state<Grab | null>(null);
  let live = $state<{ doc: MotionDoc; patch: Transform; guides: Guide[]; gaps: Gap[] } | null>(null);

  const laid = $derived(withAutoLayout(doc));
  const shown = $derived(live ? withAutoLayout(live.doc) : laid);
  const selected = $derived(selection.length === 1 ? selection[0] : null);
  const clip = $derived<MotionClip | null>(selected ? (findClip(shown, selected)?.clip ?? null) : null);
  const onFrame = (c: MotionClip) => frame >= c.from && frame < c.from + c.durationInFrames;
  const quad = $derived(clip && boxes[clip.id] && onFrame(clip) ? quadOf(shown, clip.id, frame, boxes[clip.id]) : null);
  const hoverQuad = $derived(hover && hover !== selected && !hover.includes(PART_SEP) && boxes[hover] ? quadOf(shown, hover, frame, boxes[hover]) : null);
  const hoverPart = $derived(hover && hover.includes(PART_SEP) && hover !== `${selected}${PART_SEP}${part}` ? (boxes[hover] ?? null) : null);
  const anchor = $derived(quad && clip ? anchorOf(shown, clip.id, frame) : null);
  let altHeld = $state(false);
  const measured = $derived(altHeld && quad && hoverQuad && !grab ? measureGaps(aabb(quad), aabb(hoverQuad)) : []);
  const outlinedPart = $derived(outlined?.includes(PART_SEP) ? (boxes[outlined] ?? null) : null);
  const outlinedQuad = $derived(outlined && !outlinedPart && boxes[outlined] && findClip(shown, outlined) ? quadOf(shown, outlined, frame, boxes[outlined]) : null);

  $effect(() => {
    const id = hover;
    untrack(() => onhover(id));
  });
  const split = $derived(partBoxes(boxes));
  const ownParts = $derived(selected ? (split.parts[selected] ?? []) : []);
  const partBox = $derived(part ? (ownParts.find((p) => p.part === part)?.box ?? null) : null);
  let editing = $state<{ part: string; text: string } | null>(null);
  let inPlace = $state(false);
  let editTurn = 0;
  let editAt: { x: number; y: number } | null = null;
  const editBox = $derived(part ? partBox : clip ? (boxes[clip.id] ?? null) : null);
  let partOf = '';

  $effect(() => {
    if (selected !== partOf) {
      partOf = selected ?? '';
      part = null;
      editing = null;
    }
  });

  $effect(() => {
    if (Object.keys(boxes).length) {
      onboxes(boxes);
      onparts(Object.fromEntries(Object.entries(split.parts).map(([id, list]) => [id, list.map((p) => p.part)])));
    }
  });

  function partHit(p: Pt): string | null {
    return selected && clip && boxes[selected] ? partAt(ownParts, p) : null;
  }

  const level = (): Level => levelOf({ open: true, clip: selected, part });

  function liveStack(p: Pt | null): string[] {
    if (p) {
      return stackAt(laid, frame, boxes, p);
    }
    return laid.tracks.flatMap((t) => [...t.clips].reverse()).filter((c) => onFrame(c) && boxes[c.id]).map((c) => c.id);
  }

  function probe(p: Pt | null, picked: string | null = null): Probe {
    const stack = p ? liveStack(p) : [];
    return {
      top: stack[0] ?? null,
      picked: picked ?? stack[0] ?? null,
      partOf: (id) => (p ? partAt(split.parts[id] ?? [], p) : null),
      firstClip: p ? null : (liveStack(null)[0] ?? null),
      firstPart: (id) => split.parts[id]?.[0]?.part ?? null,
      editable: (id, at) => {
        const target = findClip(doc, id)?.clip;
        return !!target && editablePart(doc, target, at ?? CLIP_TEXT) === PartEdit.Text;
      }
    };
  }

  function land(next: Level) {
    if (next.depth === Depth.Frame || next.depth === Depth.Canvas) {
      part = null;
      if (selection.length) {
        onselect([]);
      }
      return;
    }
    partOf = next.clip!;
    if (next.clip !== selected) {
      onselect([next.clip!]);
    }
    part = next.part;
  }

  function step(gesture: Gesture, p: Pt | null, from: Level = level(), picked: string | null = null): Level {
    const { level: next, edit } = drill(from, gesture, probe(p, picked));
    land(next);
    if (edit) {
      editPart(next);
    }
    return next;
  }

  export function key(gesture: Gesture.Enter | Gesture.Leave): boolean {
    const from = level();
    if (gesture === Gesture.Leave && from.depth === Depth.Frame) {
      const had = selection.length > 0;
      land(from);
      return had;
    }
    step(gesture, null, from);
    return true;
  }

  let froms: Level[] = [];

  $effect(() => {
    const el = host;
    if (!el) {
      return;
    }
    el.addEventListener('dblclick', double);
    return () => el.removeEventListener('dblclick', double);
  });

  function double(e: MouseEvent) {
    const [x, y] = local(e as PointerEvent);
    editAt = { x: x / doc.width, y: y / doc.height };
    step(Gesture.Double, local(e as PointerEvent), froms[0] ?? level());
  }

  function editPart(at: Level) {
    const target = at.part ?? CLIP_TEXT;
    const clip = at.clip ? findClip(doc, at.clip)?.clip : null;
    if (!clip || editablePart(doc, clip, target) !== PartEdit.Text) {
      return;
    }
    const text = partText(clip, target);
    const point = editAt;
    editAt = null;
    if (!edittext) {
      editing = { part: target, text };
      return;
    }
    const clipId = clip.id;
    const turn = ++editTurn;
    inPlace = true;
    void edittext(textTarget(clipId, target), point).then((typed) => {
      if (turn === editTurn) {
        inPlace = false;
      }
      if (typed === null || typed === text) {
        return;
      }
      const result = writePartText(doc, clipId, target, typed);
      if (result.ok) {
        onchange(result.doc, 'Edited text on the canvas');
      }
    });
  }

  function commitPart(text: string) {
    const was = editing;
    editing = null;
    if (!was || !clip || text === partText(clip, was.part)) {
      return;
    }
    const result = writePartText(doc, clip.id, was.part, text);
    if (result.ok) {
      onchange(result.doc, 'Edited text on the canvas');
    }
  }

  let menu = $state<{ at: Pt; part: string; actions: PartAction[] } | null>(null);

  function openMenu(e: MouseEvent) {
    const at = local(e as PointerEvent);
    const hit = partHit(at) ?? part;
    const actions = clip && hit ? PART_ACTIONS[partKind(doc, clip, hit)] : [];
    if (!hit || !actions.length) {
      openLayerMenu(e, at);
      return;
    }
    e.preventDefault();
    part = hit;
    menu = { at, part: hit, actions };
  }

  function openLayerMenu(e: MouseEvent, at: Pt) {
    const layers = liveStack(at);
    if (!onmenu || !layers.length) {
      return;
    }
    e.preventDefault();
    if (!selection.includes(layers[0])) {
      onselect([layers[0]]);
    }
    onmenu({ client: [e.clientX, e.clientY], layers });
  }

  function runMenu(action: PartAction) {
    const was = menu;
    menu = null;
    const result = was && clip ? runPart(doc, clip, was.part, action) : null;
    if (!result?.ok) {
      return;
    }
    onchange(result.doc, PART_ACTION_LOOK[action].label);
    part = PART_ACTION_LOOK[action].keepsPart ? was!.part : null;
  }

  const boxStyle = (b:{ left: number; top: number; width: number; height: number }) =>
    `left: ${(b.left / doc.width) * 100}%; top: ${(b.top / doc.height) * 100}%; width: ${(b.width / doc.width) * 100}%; height: ${(b.height / doc.height) * 100}%;`;

  let asked = 0;

  async function remeasure(retries = EMPTY_RETRIES) {
    const ticket = ++asked;
    const measured = await measure();
    if (ticket !== asked || grab) {
      return;
    }
    if (!Object.keys(measured).length && retries > 0) {
      setTimeout(() => ticket === asked && void remeasure(retries - 1), SETTLE_MS);
    }
    boxes = remeasured(
      boxes,
      Object.fromEntries(Object.entries(measured).map(([id, b]) => [id, { left: b.left * doc.width, top: b.top * doc.height, width: b.width * doc.width, height: b.height * doc.height }]))
    );
    pickPending();
  }

  let pendingPick = pickAt;
  let asking = true;

  export function editClip(clipId: string) {
    editAt = null;
    if (!selection.includes(clipId)) {
      onselect([clipId]);
    }
    editPart({ depth: Depth.Clip, clip: clipId, part: null });
  }

  export function drillAsked(asked: { at: Pt | null; gesture: Gesture; from: Depth }) {
    editAt = asked.at ? { x: asked.at[0] / doc.width, y: asked.at[1] / doc.height } : null;
    step(asked.gesture, asked.at, { depth: asked.from, clip: null, part: null });
  }

  function pickPending() {
    if (!Object.keys(boxes).length) {
      return;
    }
    const asked = asking ? ask() : null;
    asking = false;
    if (asked && (!selection.length || asked.gesture === Gesture.Double)) {
      drillAsked(asked);
      return;
    }
    if (!pendingPick) {
      return;
    }
    const at = pendingPick;
    pendingPick = null;
    step(Gesture.Click, at, levelOf({ open: true, clip: null, part: null }));
  }

  onMount(pickPending);

  $effect(() => {
    void html;
    void frame;
    void redraws;
    void remeasure();
    const later = setTimeout(() => void remeasure(), SETTLE_MS);
    return () => clearTimeout(later);
  });

  const client = (e: PointerEvent): ClientPt => ({ x: e.clientX, y: e.clientY });

  function local(e: PointerEvent): Pt {
    const rect = host!.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * doc.width, ((e.clientY - rect.top) / rect.height) * doc.height];
  }

  function snapReach(): number {
    const rect = host!.getBoundingClientRect();
    return (SNAP_SCREEN_PX * doc.width) / Math.max(rect.width, 1);
  }

  function begin(e: PointerEvent, grip: Grip, handle: number, clipId: string) {
    e.stopPropagation();
    if (e.altKey && grip !== Grip.Move) {
      press(e);
      return;
    }
    host!.setPointerCapture(e.pointerId);
    grab = { grip, handle, clipId, from: local(e), start: client(e), pointer: e.pointerId };
  }

  let lastPress: Pt | null = null;

  function press(e: PointerEvent) {
    menu = null;
    const p = local(e);
    const from = level();
    froms = [froms.at(-1) ?? from, from];
    const mode = pickModeAt(lastPress, p, e.altKey ? Modifier.Alt : Modifier.None);
    lastPress = p;
    const gesture = e.metaKey || e.ctrlKey ? Gesture.Deep : Gesture.Click;
    const next = step(gesture, p, from, pick(stackAt(laid, frame, boxes, p), selected, mode));
    if (next.depth === Depth.Clip) {
      begin(e, Grip.Move, 0, next.clip!);
    }
  }

  function hoverAt(p: Pt): string | null {
    const { level: target } = drill(level(), Gesture.Hover, probe(p));
    if (!target.clip) {
      return null;
    }
    return target.part ? `${target.clip}${PART_SEP}${target.part}` : target.clip;
  }

  function others(clipId: string) {
    return Object.keys(boxes)
      .filter((id) => id !== clipId && findClip(doc, id) && onFrame(findClip(doc, id)!.clip))
      .map((id) => aabb(quadOf(laid, id, frame, boxes[id])));
  }

  let out = false;

  function leaving(e: PointerEvent): ElementOut | null {
    if (!ondragout || grab?.grip !== Grip.Move || !isOutside(host!.getBoundingClientRect(), { x: e.clientX, y: e.clientY })) {
      return null;
    }
    const b = boxes[grab.clipId];
    const box = b ? { left: b.left / doc.width, top: b.top / doc.height, width: b.width / doc.width, height: b.height / doc.height } : null;
    return { clipId: grab.clipId, client: { x: e.clientX, y: e.clientY }, box };
  }

  function move(e: PointerEvent) {
    if (!grab) {
      hover = e.pointerType === 'mouse' ? hoverAt(local(e)) : null;
      return;
    }
    const hosted = hostGesture(grab, e);
    if (hosted) {
      onhostdrag!(hosted.move, hosted.to, DragPhase.Over);
      return;
    }
    const outside = leaving(e);
    if (outside || out) {
      ondragout?.(outside ?? { clipId: grab.clipId, client: { x: e.clientX, y: e.clientY }, box: null }, outside ? DragPhase.Over : DragPhase.Back);
      out = outside !== null;
    }
    if (outside) {
      live = null;
      onpreview(null);
      return;
    }
    const box = boxes[grab.clipId];
    if (!box) {
      return;
    }
    const { patch, guides } = dragPatch({ doc: laid, clipId: grab.clipId, frame, box, grip: grab.grip, handle: grab.handle, from: grab.from, to: local(e), shift: e.shiftKey, snapTargets: others(grab.clipId), snapPx: snapReach() });
    const result = writePatch(doc, grab.clipId, frame, patch);
    if (!result.ok) {
      return;
    }
    const moved = aabb(quadOf(withAutoLayout(result.doc), grab.clipId, frame, box));
    live = { doc: result.doc, patch, guides, gaps: grab.grip === Grip.Rotate ? [] : spacing(moved, others(grab.clipId), { width: doc.width, height: doc.height }) };
    onpreview(result.doc);
  }

  const HOST_GRIPS = new Set<Grip>([Grip.Move, Grip.Scale, Grip.Rotate]);
  const STILL = { dx: 0, dy: 0, dw: 0, dh: 0 };

  function hostGesture(g: Grab | null, e: PointerEvent | null): { move: HostMove; to: ClientPt } | null {
    if (!onhostdrag || !g || !HOST_GRIPS.has(g.grip)) {
      return null;
    }
    const to = e ? client(e) : g.start;
    if (g.grip === Grip.Rotate) {
      const rect = host!.getBoundingClientRect();
      return { move: { ...STILL, turn: hostTurn({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, g.start, to) }, to };
    }
    const unit = g.grip === Grip.Scale && quad ? handlesOf(quad)[g.handle].unit : null;
    return { move: { ...hostShift(unit, g.start, to), turn: 0 }, to };
  }

  function end(e: PointerEvent | null) {
    const done = live;
    const grip = grab?.grip;
    const hosting = hostGesture(grab, e);
    const reordered = done && grip === Grip.Move && grab && e ? reorderAt(doc, grab.clipId, local(e)) : null;
    const outside = grab && e ? leaving(e) : null;
    out = false;
    grab = null;
    live = null;
    onpreview(null);
    if (hosting) {
      onhostdrag!(hosting.move, hosting.to, DragPhase.Drop);
      return;
    }
    if (outside) {
      ondragout?.(outside, DragPhase.Drop);
      return;
    }
    if (reordered?.ok) {
      onchange(reordered.doc, 'Reordered in the auto layout');
      return;
    }
    if (done && grip) {
      onchange(resizedTexts(doc, done.doc), SUMMARY[grip]);
    }
  }

  const pct = ([x, y]: Pt) => `left: ${(x / doc.width) * 100}%; top: ${(y / doc.height) * 100}%;`;
  const points = (q: Quad) => q.map((p) => p.join(',')).join(' ');

  function outward(q: Quad, corner: Pt): string {
    const cx = (q[0][0] + q[2][0]) / 2;
    const cy = (q[0][1] + q[2][1]) / 2;
    const length = Math.hypot(corner[0] - cx, corner[1] - cy) || 1;
    return `${pct(corner)} --dx: ${((corner[0] - cx) / length) * ROTATE_REACH_PX}px; --dy: ${((corner[1] - cy) / length) * ROTATE_REACH_PX}px;`;
  }
</script>

<svelte:window onkeydown={(e) => (altHeld = e.altKey)} onkeyup={(e) => (altHeld = e.altKey)} onblur={() => (altHeld = false)} />

<div class="overlay" class:typing={inPlace} bind:this={host} data-testid="selection-overlay" role="presentation" oncontextmenu={openMenu} onpointerdown={press} onpointermove={move} onpointerup={end} onpointercancel={() => end(null)} onpointerleave={() => (hover = null)}>
  <svg viewBox={`0 0 ${doc.width} ${doc.height}`} preserveAspectRatio="none" aria-hidden="true">
    {#if hoverQuad && !grab}<polygon class="hover" points={points(hoverQuad)} data-testid="hover-box" />{/if}
    {#if outlinedQuad}<polygon class="outlined" points={points(outlinedQuad)} data-testid="layer-hover-box" />{/if}
    {#if quad}<polygon class="box" class:passive={!chrome.handles} points={points(quad)} data-testid="selection-box" data-ring={chrome.ring} />{/if}
    {#each live?.gaps ?? [] as g (g.axis + g.from + g.to)}
      {#if g.axis === 'x'}<line class="gap" x1={g.from} y1={g.at} x2={g.to} y2={g.at} />{:else}<line class="gap" x1={g.at} y1={g.from} x2={g.at} y2={g.to} />{/if}
    {/each}
    {#each measured as g (g.axis + g.from + g.to + g.at)}
      {#if g.axis === 'x'}<line class="gap" x1={g.from} y1={g.at} x2={g.to} y2={g.at} />{:else}<line class="gap" x1={g.at} y1={g.from} x2={g.at} y2={g.to} />{/if}
    {/each}
    {#each live?.guides ?? [] as g (g.axis + g.at)}
      {#if g.axis === 'x'}<line class="guide" x1={g.at} y1="0" x2={g.at} y2={doc.height} />{:else}<line class="guide" x1="0" y1={g.at} x2={doc.width} y2={g.at} />{/if}
    {/each}
  </svg>
  {#each live?.gaps ?? [] as g (g.axis + g.from + g.to)}
    <span class="gap-label" data-testid="gap-label" style={pct(g.axis === 'x' ? [(g.from + g.to) / 2, g.at] : [g.at, (g.from + g.to) / 2])}>{Math.round(g.to - g.from)}</span>
  {/each}
  {#each measured as g (g.axis + g.from + g.to + g.at)}
    <span class="gap-label" data-testid="measure-label" style={pct(g.axis === 'x' ? [(g.from + g.to) / 2, g.at] : [g.at, (g.from + g.to) / 2])}>{Math.round(g.to - g.from)}</span>
  {/each}
  {#if hoverPart && !grab}
    <div class="outlined-part hover-part" data-testid="hover-part" style={boxStyle(hoverPart)}></div>
  {/if}
  {#if outlinedPart}
    <div class="outlined-part" data-testid="layer-hover-part" style={boxStyle(outlinedPart)}></div>
  {/if}
  {#if quad && clip}
    {@const handles = chrome.handles ? handlesOf(quad) : []}
    {#each handles.slice(0, 4) as h, i (i)}
      <button type="button" class="target rotate" aria-label="Rotate" style={outward(quad, h.at)} onpointerdown={(e) => begin(e, Grip.Rotate, i, clip.id)}></button>
    {/each}
    {#each handles as h, i (i)}
      <button type="button" class="target scale" aria-label="Scale" data-handle={i} style={pct(h.at)} onpointerdown={(e) => begin(e, Grip.Scale, i, clip.id)}><span></span></button>
    {/each}
    {#if anchor && chrome.handles && !onhostdrag}
      <button type="button" class="target anchor" aria-label="Anchor point" data-testid="selection-anchor" style={pct(anchor)} onpointerdown={(e) => begin(e, Grip.Anchor, 0, clip.id)}><span></span></button>
    {/if}
    {#if partBox && part}
      <div class="part-box" data-testid="part-box" data-part={part} style={boxStyle(partBox)}>
        {#each [0, 1, 2, 3] as corner (corner)}<span class="part-handle" data-corner={corner}></span>{/each}
      </div>
    {/if}
    {#if menu}
      <div class="part-menu" role="menu" data-testid="part-menu" style={pct(menu.at)} onpointerdown={(e) => e.stopPropagation()}>
        {#each menu.actions as action (action)}
          <button type="button" role="menuitem" onclick={() => runMenu(action)}>{PART_ACTION_LOOK[action].label}</button>
        {/each}
      </div>
    {/if}
    {#if editing && editBox}
      <!-- svelte-ignore a11y_autofocus -->
      <textarea
        class="part-edit"
        data-testid="part-edit"
        aria-label="Edit text"
        style={boxStyle(editBox)}
        value={editing.text}
        autofocus
        onpointerdown={(e) => e.stopPropagation()}
        onblur={(e) => commitPart(e.currentTarget.value)}
        onkeydown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') {
            editing = null;
          }
        }}
      ></textarea>
    {/if}
    {#if live}<output class="readout">{readout(clip.component as ComponentId, live.patch, doc)}</output>{/if}
  {/if}
</div>

<style>
  .overlay.typing {
    pointer-events: none;
  }

  .overlay {
    position: absolute;
    inset: 0;
    touch-action: none;
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }

  .box,
  .hover,
  .outlined,
  .guide {
    fill: none;
    vector-effect: non-scaling-stroke;
  }

  .box {
    stroke: var(--ui-accent);
    stroke-width: 1.5px;
  }

  .box.passive {
    stroke-width: 1px;
    stroke-dasharray: 4 3;
    opacity: 0.6;
  }

  .hover {
    stroke: var(--ui-accent);
    stroke-width: 1px;
    opacity: 0.5;
  }

  .outlined {
    stroke: var(--ui-hover-outline);
    stroke-width: 1.5px;
  }

  .outlined-part {
    position: absolute;
    pointer-events: none;
    border: 1.5px solid var(--ui-hover-outline);
  }

  .guide {
    stroke: #ff3d7f;
    stroke-width: 1px;
  }

  .gap {
    stroke: #ff3d7f;
    stroke-width: 1px;
    stroke-dasharray: 3 2;
    vector-effect: non-scaling-stroke;
  }

  .gap-label {
    position: absolute;
    transform: translate(-50%, -50%);
    padding: 0 3px;
    background: #ff3d7f;
    color: #fff;
    font-size: 10px;
    line-height: 14px;
    pointer-events: none;
    white-space: nowrap;
  }

  .target {
    position: absolute;
    width: 44px;
    height: 44px;
    padding: 0;
    border: none;
    background: transparent;
    transform: translate(-50%, -50%);
    display: grid;
    place-items: center;
    touch-action: none;
  }

  .target span {
    width: 9px;
    height: 9px;
    background: #fff;
    border: 1.5px solid var(--ui-accent);
  }

  .scale {
    cursor: nwse-resize;
  }

  .rotate {
    transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy)));
    cursor: grab;
  }

  .anchor {
    cursor: crosshair;
  }

  .anchor span {
    width: 11px;
    height: 11px;
    background: transparent;
    border: 1.5px solid var(--ui-accent);
    box-shadow: inset 0 0 0 3px #fff;
  }

  .part-box {
    position: absolute;
    outline: 1.5px dashed var(--ui-accent);
    pointer-events: none;
  }

  .part-handle {
    position: absolute;
    width: 7px;
    height: 7px;
    background: #fff;
    border: 1.5px solid var(--ui-accent);
    transform: translate(-50%, -50%);
  }

  .part-handle[data-corner='0'] {
    left: 0;
    top: 0;
  }

  .part-handle[data-corner='1'] {
    left: 100%;
    top: 0;
  }

  .part-handle[data-corner='2'] {
    left: 100%;
    top: 100%;
  }

  .part-handle[data-corner='3'] {
    left: 0;
    top: 100%;
  }

  .part-menu {
    position: absolute;
    z-index: 3;
    display: grid;
    min-width: 140px;
    padding: 4px;
    background: var(--ui-bg);
    border: 1px solid var(--ui-line);
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.12);
    pointer-events: auto;
  }

  .part-menu button {
    padding: 6px 8px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-sm);
    text-align: left;
  }

  .part-menu button:hover {
    background: var(--ui-hover);
  }

  .part-edit {
    position: absolute;
    min-width: 120px;
    min-height: 1.6em;
    padding: 2px 4px;
    border: 1.5px solid var(--ui-accent);
    border-radius: 0;
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-sm);
    resize: none;
    z-index: 2;
  }

  .readout {
    position: absolute;
    left: var(--ui-space-2);
    bottom: var(--ui-space-2);
    padding: 2px var(--ui-space-2);
    font-size: var(--ui-text-xs);
    background: var(--ui-bg);
    color: var(--ui-ink);
    border: 1px solid var(--ui-line-strong);
    pointer-events: none;
  }
</style>
