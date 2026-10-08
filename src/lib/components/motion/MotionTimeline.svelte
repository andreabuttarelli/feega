<script lang="ts">
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { tick } from 'svelte';
  import Link2 from '@lucide/svelte/icons/link-2';
  import { CLIP_FAMILIES, ClipFamily, Preview, familyOf, tileFrames } from '$lib/motion/track-style';
  import { filmstrip, type Strip } from '$lib/motion/filmstrip';
  import { COMPONENTS, THREE_D_COMPONENTS, TrackKind } from '$lib/motion/components';
  import { compOf, type MotionClip, type MotionDoc } from '$lib/motion/doc';
  import { ClipEdge, moveClip, moveKeyframes, moveTrack, removeKeyframes, setKeyEase, setKeyInterp, setKeyframe, trimClip, type KeyRef, type OpResult } from '$lib/motion/timeline';
  import { withParams } from '$lib/motion/custom/params';
  import { Grip, KeySide, Reveal, Snap, edgeHandles, frameAt, keyLanes, pxPerFrame, snapped } from '$lib/motion/timeline-view';
  import { KeyMark, RowKind, keyGlyph, keyMark, layerName, layerRows, pinched, propValue, rulerMarks, type PropLane } from '$lib/motion/timeline-layers';
  import { MASK_KINDS, Matte } from '$lib/motion/mask';
  import type { MotionTrack } from '$lib/motion/doc';
  import { Interp, Source, type EaseSpec, type Keyframe } from '$lib/motion/keyframes';
  import { CAMERA, CAMERA_LANE, type CameraKey } from '$lib/motion/camera';
  import { cameraEditAt, cameraLanes, cameraValueAt } from '$lib/motion/camera-ops';
  import { animProp, ValueKind } from '$lib/motion/keyframes';
  import { editAt, parseDecimal, valueAt } from '$lib/motion/inspector';
  import { sliderOf, toShown, toStored, type Owner } from '$lib/motion/units';
  import { formatValue, precisionOf, scrubbed, type Range } from '$lib/motion/number-field';
  import { ancestorsOf } from '$lib/motion/parent';
  import { setParent } from '$lib/motion/parent-ops';
  import EasePicker from './EasePicker.svelte';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import Lock from '@lucide/svelte/icons/lock';
  import LockOpen from '@lucide/svelte/icons/lock-open';
  import Headphones from '@lucide/svelte/icons/headphones';
  import Ghost from '@lucide/svelte/icons/ghost';
  import { allMarkers, isLocked, setClipFlags, setTrackFlags, shownTracks } from '$lib/motion/organize';
  import { PEAKS_PER_SECOND, clipPeaks, wavePath } from '$lib/motion/waveform';
  import { FadeEdge, dragFade, fadeHandles } from '$lib/motion/fade-handles';

  const HEADER_PX = 240;
  const COMPACT_HEADER_PX = 180;
  const COMPACT_BELOW_PX = 760;
  const TILE_PX = 64;
  const MAX_TILES = 48;
  const INDENT_PX = 10;

  const Drag = { Move: 'move', TrimStart: 'trim-start', TrimEnd: 'trim-end', Scrub: 'scrub', Keys: 'keys', FadeIn: 'fade-in', FadeOut: 'fade-out' } as const;
  type Drag = (typeof Drag)[keyof typeof Drag];

  type KeyOwner = { id: string; from: number; keyframes: Partial<Record<string, Keyframe[]>> };

  type Gesture = { kind: Drag; clipId: string; trackId: string; grabFrame: number; originFrom: number; base: MotionDoc; refs: KeyRef[]; delta: number };

  let {
    doc,
    frame = $bindable(0),
    selection = $bindable<string[]>([]),
    keySelection = $bindable<KeyRef[]>([]),
    camera = $bindable(false),
    zoom = $bindable(1),
    snap,
    waveforms = {},
    beats = [],
    assetUrls = {},
    reveal = Reveal.Animated,
    onchange,
    onopen
  }: {
    doc: MotionDoc;
    frame?: number;
    selection?: string[];
    keySelection?: KeyRef[];
    camera?: boolean;
    zoom?: number;
    snap: Snap;
    waveforms?: Record<string, number[]>;
    beats?: number[];
    assetUrls?: Record<string, string>;
    reveal?: Reveal;
    onchange: (doc: MotionDoc, summary: string) => void;
    onopen?: (comp: string) => void;
  } = $props();

  let folded = $state<string[]>([]);
  let solo = $state<string[]>([]);
  let shy = $state<string[]>([]);
  let hideShy = $state(false);
  let filter = $state('');
  let viewportWidth = $state(1440);
  const headPx = $derived(viewportWidth < COMPACT_BELOW_PX ? COMPACT_HEADER_PX : HEADER_PX);
  let strips = $state<Record<string, Strip>>({});

  let open = $state<string[]>([]);
  let easing = $state<{ ref: KeyRef; next: KeyRef; ease: EaseSpec; left: number; top: number } | null>(null);
  let whip = $state<{ clipId: string; x0: number; y0: number; x: number; y: number } | null>(null);

  let draft = $state<MotionDoc | null>(null);
  let gesture: Gesture | null = null;
  let lanes = $state<HTMLDivElement | null>(null);

  const shown = $derived(draft ?? doc);
  const ppf = $derived(pxPerFrame(zoom, doc.fps));
  const tracks = $derived(shownTracks(shown, { solo, shy, hideShy, filter }));
  const markers = $derived(allMarkers(shown));

  const toggled = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  function flag(trackId: string, flags: { hidden?: boolean; locked?: boolean }, summary: string) {
    const result = setTrackFlags(doc, trackId, flags);
    if (result.ok) {
      onchange(result.doc, summary);
    }
  }

  const width = $derived(Math.max(shown.durationInFrames * ppf + 120, 400));
  const marks = $derived(rulerMarks(shown.durationInFrames, zoom, doc.fps));
  const cameraShown = $derived(!!shown.camera || shown.tracks.some((t) => t.clips.some((c) => THREE_D_COMPONENTS.includes(c.component))));

  function lanesOf(clip: MotionClip): PropLane[] {
    return keyLanes(withParams(shown, clip), reveal).map((l) => ({ prop: l.prop, label: l.source === Source.Mask ? `Mask · ${l.label}` : l.label }));
  }

  const isOpen = (clip: MotionClip) => open.includes(clip.id) || (reveal !== Reveal.Animated && selection.includes(clip.id));
  const rows = $derived(layerRows(tracks, { folded, open: tracks.flatMap((t) => (t.clips as MotionClip[]).filter(isOpen).map((c) => c.id)), lanes: lanesOf }));

  function keyFrames(clip: MotionClip): number[] {
    return [...new Set(Object.values(clip.keyframes).flatMap((keys) => (keys ?? []).map((k) => k.frame)))];
  }

  function toggleOpen(clipId: string) {
    open = toggled(open, clipId);
    if (open.includes(clipId)) {
      selection = [clipId];
      camera = false;
    }
    void revealLanes(clipId);
  }

  function pickLayer(e: PointerEvent, clip: MotionClip) {
    select(clip.id, e);
    keySelection = [];
  }

  function clipFlag(clipId: string, flags: { hidden?: boolean; locked?: boolean }, summary: string) {
    const result = setClipFlags(doc, clipId, flags);
    if (result.ok) {
      onchange(result.doc, summary);
    }
  }

  type PropEdit = { shown: number; range: Range; unit: string; set: (shownValue: number) => void };

  const sameColor = (c: string) => c;

  function clipEdit(clip: MotionClip, key: string): PropEdit | null {
    const prop = animProp(clip.component, key, withParams(doc, clip).params);
    if (!prop || prop.kind !== ValueKind.Number) {
      return null;
    }
    return unitEdit(clip.component, prop, Number(valueAt(withParams(shown, clip), key, frame, sameColor)), (stored) => editAt(doc, clip, key, stored, frame));
  }

  function cameraEdit(key: CameraKey): PropEdit {
    return unitEdit(CAMERA_LANE, { key, ...CAMERA[key] }, cameraValueAt(shown, key, frame), (stored) => cameraEditAt(doc, key, Math.min(CAMERA[key].max, Math.max(CAMERA[key].min, stored)), frame));
  }

  function unitEdit(owner: Owner, prop: Range & { key: string }, stored: number, write: (stored: number) => OpResult): PropEdit {
    const slider = sliderOf(owner, prop, doc);
    return {
      shown: toShown(owner, prop.key, stored, doc),
      range: slider,
      unit: slider.unit ?? '',
      set: (v) => {
        const result = write(toStored(owner, prop.key, v, doc));
        if (result.ok) {
          onchange(result.doc, `Edited ${prop.key}`);
        }
      }
    };
  }

  const propEdit = (owner: KeyOwner, key: string): PropEdit | null => (owner.id === CAMERA_LANE ? cameraEdit(key as CameraKey) : clipEdit(clipById(owner.id), key));

  let typing = $state<string | null>(null);
  let valueScrub: { x: number; start: number; edit: PropEdit; moved: boolean } | null = null;
  const TAP_SLOP_PX = 3;

  function startValue(e: PointerEvent, edit: PropEdit) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    valueScrub = { x: e.clientX, start: edit.shown, edit, moved: false };
  }

  function moveValue(e: PointerEvent) {
    if (!valueScrub) {
      return;
    }
    const dx = e.clientX - valueScrub.x;
    valueScrub.moved ||= Math.abs(dx) > TAP_SLOP_PX;
    if (valueScrub.moved) {
      valueScrub.edit.set(scrubbed(valueScrub.start, dx, valueScrub.edit.range, precisionOf(e)));
    }
  }

  function endValue(rowId: string) {
    if (valueScrub && !valueScrub.moved) {
      typing = rowId;
    }
    valueScrub = null;
  }

  function typeValue(edit: PropEdit, text: string) {
    typing = null;
    const parsed = parseDecimal(text);
    if (parsed !== null) {
      edit.set(Math.min(edit.range.max, Math.max(edit.range.min, parsed)));
    }
  }

  function focusSelect(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  const fingers = new Map<number, number>();
  let pinch: { zoom: number; distance: number } | null = null;

  const spread = () => Math.abs([...fingers.values()].reduce((a, b) => a - b));

  function touchDown(e: PointerEvent) {
    if (e.pointerType !== 'touch') {
      return;
    }
    fingers.set(e.pointerId, e.clientX);
    if (fingers.size === 2) {
      pinch = { zoom, distance: Math.max(1, spread()) };
      gesture = null;
      draft = null;
    }
  }

  function touchMove(e: PointerEvent) {
    if (!fingers.has(e.pointerId)) {
      return;
    }
    fingers.set(e.pointerId, e.clientX);
    if (pinch && fingers.size === 2) {
      zoom = pinched(pinch.zoom, pinch.distance, Math.max(1, spread()));
    }
  }

  function touchUp(e: PointerEvent) {
    fingers.delete(e.pointerId);
    if (fingers.size < 2) {
      pinch = null;
    }
  }

  function toggleMark(owner: KeyOwner, prop: string, mark: KeyMark) {
    const local = frame - owner.from;
    const keys = owner.keyframes[prop] ?? [];
    const value = keys.every((k) => typeof k.value === 'number') ? Number(propValue(keys, local)) : (keys.findLast((k) => k.frame <= local) ?? keys[0])?.value;
    const result = mark === KeyMark.Here ? removeKeyframes(doc, owner.id, prop, [local]) : setKeyframe(doc, owner.id, prop, local, value ?? 0);
    if (result.ok) {
      onchange(result.doc, 'Toggled a keyframe');
    }
  }

  function frameOfPointer(e: PointerEvent): number {
    const rect = lanes!.getBoundingClientRect();
    return frameAt(e.clientX - rect.left + lanes!.scrollLeft - headPx, zoom, doc.fps);
  }

  function select(clipId: string, e: PointerEvent) {
    camera = false;
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      selection = selection.includes(clipId) ? selection.filter((id) => id !== clipId) : [...selection, clipId];
      return;
    }
    if (!selection.includes(clipId)) {
      selection = [clipId];
    }
  }

  const GRIP_DRAG: Record<Grip, Drag> = { [Grip.Start]: Drag.TrimStart, [Grip.End]: Drag.TrimEnd };
  const FADE_LABEL: Record<FadeEdge, string> = { [FadeEdge.In]: 'Fade in', [FadeEdge.Out]: 'Fade out' };
  const FADE_DRAG: Record<FadeEdge, Drag> = { [FadeEdge.In]: Drag.FadeIn, [FadeEdge.Out]: Drag.FadeOut };

  function startClip(e: PointerEvent, clip: MotionClip, trackId: string, kind: Drag = Drag.Move) {
    e.stopPropagation();
    select(clip.id, e);
    keySelection = [];
    if (isLocked(doc, clip.id)) {
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gesture = { kind, clipId: clip.id, trackId, grabFrame: frameOfPointer(e), originFrom: clip.from, base: doc, refs: [], delta: 0 };
  }

  const sameKey = (a: KeyRef, b: KeyRef) => a.clipId === b.clipId && a.prop === b.prop && a.frame === b.frame;

  function startKey(e: PointerEvent, clip: KeyOwner, ref: KeyRef) {
    e.stopPropagation();
    easing = null;
    const picked = keySelection.some((k) => sameKey(k, ref));
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      keySelection = picked ? keySelection.filter((k) => !sameKey(k, ref)) : [...keySelection, ref];
    } else if (!picked) {
      keySelection = [ref];
    }
    frame = clip.from + ref.frame;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gesture = { kind: Drag.Keys, clipId: clip.id, trackId: '', grabFrame: clip.from + ref.frame, originFrom: clip.from + ref.frame, base: doc, refs: keySelection, delta: 0 };
  }

  function openEase(e: MouseEvent, clip: KeyOwner, ref: KeyRef, next: KeyRef, ease: EaseSpec) {
    e.stopPropagation();
    const rect = lanes!.getBoundingClientRect();
    easing = { ref, next, ease, left: e.clientX - rect.left + lanes!.scrollLeft, top: e.clientY - rect.top + lanes!.scrollTop + 8 };
  }

  function pickEase(ease: EaseSpec) {
    if (!easing) {
      return;
    }
    const result = setKeyEase(doc, easing.ref, ease);
    if (result.ok) {
      easing = { ...easing, ease };
      onchange(result.doc, 'Changed an ease');
    }
  }

  function keyAt(ref: KeyRef): Keyframe | undefined {
    const owner = ref.clipId === CAMERA_LANE ? shown.camera?.keyframes : clipById(ref.clipId)?.keyframes;
    return (owner as Partial<Record<string, Keyframe[]>> | undefined)?.[ref.prop]?.find((k) => k.frame === ref.frame);
  }

  function segmentKinds(at: { ref: KeyRef; next: KeyRef }): Record<KeySide, Interp> {
    return { [KeySide.Out]: keyAt(at.ref)?.out ?? Interp.Bezier, [KeySide.In]: keyAt(at.next)?.in ?? Interp.Bezier };
  }

  function pickKind(side: KeySide, kind: Interp) {
    if (!easing) {
      return;
    }
    const target = side === KeySide.Out ? easing.ref : easing.next;
    const result = setKeyInterp(doc, [target], { [side]: kind });
    if (result.ok) {
      onchange(result.doc, 'Changed an interpolation');
    }
  }

  async function revealLanes(clipId: string) {
    await tick();
    lanes?.querySelector(`[data-key-lane^="${clipId}:"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function clipById(id: string): MotionClip {
    return shown.tracks.flatMap((t) => t.clips).find((c) => c.id === id) as MotionClip;
  }

  const cameraOwner = $derived<KeyOwner | null>(shown.camera ? { id: CAMERA_LANE, from: 0, keyframes: shown.camera.keyframes } : null);

  function pickCamera(e: PointerEvent) {
    e.stopPropagation();
    camera = true;
    selection = [];
    keySelection = [];
  }

  function pointInTimeline(e: PointerEvent): { x: number; y: number } {
    const rect = lanes!.getBoundingClientRect();
    return { x: e.clientX - rect.left + lanes!.scrollLeft, y: e.clientY - rect.top + lanes!.scrollTop };
  }

  function startWhip(e: PointerEvent, clipId: string) {
    e.stopPropagation();
    e.preventDefault();
    const at = pointInTimeline(e);
    whip = { clipId, x0: at.x, y0: at.y, x: at.x, y: at.y };
  }

  function dropWhip(e: PointerEvent) {
    const from = whip!.clipId;
    whip = null;
    const hit = document.elementsFromPoint(e.clientX, e.clientY).find((n) => (n as HTMLElement).dataset?.clipId) as HTMLElement | undefined;
    const target = hit?.dataset.clipId;
    if (!target || target === from) {
      return;
    }
    const result = setParent(doc, from, target, { at: frame });
    if (result.ok) {
      onchange(result.doc, 'Parented a clip');
    }
  }

  function parentName(clip: MotionClip): string {
    const parent = shown.tracks.flatMap((t) => t.clips).find((c) => c.id === clip.parent);
    return parent ? parent.id : '';
  }

  function startScrub(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gesture = { kind: Drag.Scrub, clipId: '', trackId: '', grabFrame: 0, originFrom: 0, base: doc, refs: [], delta: 0 };
    frame = Math.min(frameOfPointer(e), doc.durationInFrames - 1);
  }

  function trackUnder(e: PointerEvent): string | null {
    const hit = document.elementsFromPoint(e.clientX, e.clientY).find((n) => (n as HTMLElement).dataset?.trackId);
    return (hit as HTMLElement | undefined)?.dataset.trackId ?? null;
  }

  const GESTURES: Record<Exclude<Drag, typeof Drag.Scrub>, (g: Gesture, at: number, e: PointerEvent) => OpResult> = {
    [Drag.Move]: (g, at, e) => {
      const from = g.originFrom + (at - g.grabFrame);
      const clip = g.base.tracks.flatMap((t) => t.clips).find((c) => c.id === g.clipId)!;
      const start = snapped(g.base, from, { playhead: frame, exclude: [g.clipId], zoom, snap, beats });
      const endSnap = snapped(g.base, from + clip.durationInFrames, { playhead: frame, exclude: [g.clipId], zoom, snap, beats }) - clip.durationInFrames;
      const target = start !== from ? start : endSnap;
      const over = trackUnder(e);
      const sameKind = g.base.tracks.find((t) => t.id === over)?.kind === g.base.tracks.find((t) => t.id === g.trackId)?.kind;
      return moveClip(g.base, g.clipId, { from: target, trackId: over && sameKind ? over : undefined });
    },
    [Drag.TrimStart]: (g, at) => trimClip(g.base, g.clipId, ClipEdge.Start, snapped(g.base, at, { playhead: frame, exclude: [g.clipId], zoom, snap, beats })),
    [Drag.TrimEnd]: (g, at) => trimClip(g.base, g.clipId, ClipEdge.End, snapped(g.base, at, { playhead: frame, exclude: [g.clipId], zoom, snap, beats })),
    [Drag.FadeIn]: (g, at) => dragFade(g.base, g.clipId, FadeEdge.In, at),
    [Drag.FadeOut]: (g, at) => dragFade(g.base, g.clipId, FadeEdge.Out, at),
    [Drag.Keys]: (g, at) => {
      g.delta = snapped(g.base, g.originFrom + (at - g.grabFrame), { playhead: g.originFrom, exclude: [], zoom, snap, beats }) - g.originFrom;
      return moveKeyframes(g.base, g.refs, g.delta);
    }
  };

  function onMove(e: PointerEvent) {
    if (whip) {
      const at = pointInTimeline(e);
      whip = { ...whip, x: at.x, y: at.y };
      return;
    }
    if (!gesture) {
      return;
    }
    const at = frameOfPointer(e);
    if (gesture.kind === Drag.Scrub) {
      frame = Math.min(at, doc.durationInFrames - 1);
      return;
    }
    const result = GESTURES[gesture.kind](gesture, at, e);
    if (result.ok) {
      draft = result.doc;
    }
  }

  const SUMMARY: Record<Drag, string> = { [Drag.Move]: 'Moved a clip', [Drag.TrimStart]: 'Trimmed a clip', [Drag.TrimEnd]: 'Trimmed a clip', [Drag.Scrub]: '', [Drag.Keys]: 'Moved keyframes', [Drag.FadeIn]: 'Changed a fade', [Drag.FadeOut]: 'Changed a fade' };

  function onUp(e: PointerEvent) {
    if (whip) {
      dropWhip(e);
      return;
    }
    if (gesture && draft && gesture.kind !== Drag.Scrub) {
      onchange(draft, SUMMARY[gesture.kind]);
    }
    if (gesture?.kind === Drag.Keys && draft) {
      const delta = gesture.delta;
      keySelection = gesture.refs.map((r) => ({ ...r, frame: Math.max(0, r.frame + delta) }));
    }
    gesture = null;
    draft = null;
  }

  function reorder(trackId: string, delta: number) {
    const index = doc.tracks.findIndex((t) => t.id === trackId);
    const result = moveTrack(doc, trackId, index + delta);
    if (result.ok) {
      onchange(result.doc, 'Reordered tracks');
    }
  }

  function waveOf(clip: MotionClip): { path: string; width: number } | null {
    const peaks = waveforms[(clip.props as { assetId?: string | null }).assetId ?? ''];
    if (!peaks) {
      return null;
    }
    const width = Math.max(1, Math.round((clip.durationInFrames / shown.fps) * PEAKS_PER_SECOND));
    return { path: wavePath(clipPeaks(peaks, { trimStart: clip.trimStart, durationInFrames: clip.durationInFrames, fps: shown.fps })), width };
  }

  function trackFamily(track: MotionTrack): ClipFamily {
    if (track.kind === TrackKind.Audio) {
      return ClipFamily.Audio;
    }
    const first = track.clips[0];
    return first ? familyOf(first.component) : ClipFamily.Video;
  }

  function hueOf(family: ClipFamily): string {
    return `--hue: ${CLIP_FAMILIES[family].hue};`;
  }

  function toggleFold(trackId: string) {
    folded = folded.includes(trackId) ? folded.filter((id) => id !== trackId) : [...folded, trackId];
  }

  function assetOf(clip: MotionClip): string | null {
    const id = (clip.props as { assetId?: string | null }).assetId;
    return id ? (assetUrls[id] ?? null) : null;
  }

  function stripTiles(clip: MotionClip, url: string): string[] {
    const strip = strips[url];
    if (!strip) {
      return [];
    }
    const tiles = Math.min(MAX_TILES, Math.max(1, Math.ceil((clip.durationInFrames * ppf) / TILE_PX)));
    const picks = tileFrames({ samples: strip.frames.length, sourceSeconds: strip.seconds, trimSeconds: clip.trimStart / shown.fps, clipSeconds: clip.durationInFrames / shown.fps, tiles });
    return picks.map((i) => strip.frames[i]);
  }

  function whenVisible(node: HTMLElement, url: string) {
    const watcher = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) {
        return;
      }
      watcher.disconnect();
      filmstrip(url)
        .then((strip) => (strips = { ...strips, [url]: strip }))
        .catch(() => {});
    });
    watcher.observe(node);
    return { destroy: () => watcher.disconnect() };
  }

  function openComp(clip: MotionClip) {
    const comp = compOf(clip);
    if (comp && doc.comps[comp]) {
      onopen?.(comp);
    }
  }

  function clipLabel(clip: MotionClip): string {
    const p = clip.props as { text?: string; title?: string; name?: string };
    const comp = compOf(clip);
    const label = clip.component === 'Custom' ? p.name : comp ? doc.comps[comp]?.name : undefined;
    return label ?? p.text?.split('\n')[0] ?? p.title ?? COMPONENTS[clip.component].label;
  }
</script>

<svelte:window bind:innerWidth={viewportWidth} onpointermove={onMove} onpointerup={onUp} />

{#snippet propRow(owner: KeyOwner, lane: PropLane, rowId: string)}
  {@const keys = owner.keyframes[lane.prop] ?? []}
  {@const mark = keyMark(keys, frame - owner.from)}
  {@const edit = propEdit(owner, lane.prop)}
  <div class="row prop" data-key-lane={rowId}>
    <div class="head">
      <span class="indent prop-indent"></span>
      <button type="button" class="mark" data-mark={mark} aria-label={mark === KeyMark.Here ? `Remove ${lane.label} keyframe` : `Add ${lane.label} keyframe`} title={mark === KeyMark.Here ? 'Remove keyframe here' : 'Add keyframe here'} disabled={owner.id === CAMERA_LANE} onclick={() => toggleMark(owner, lane.prop, mark)}></button>
      <span class="prop-name">{lane.label}</span>
      {#if !edit}
        <span class="prop-value">{propValue(keys, frame - owner.from)}</span>
      {:else if typing === rowId}
        <input class="prop-input" use:focusSelect aria-label={`${lane.label} value`} value={formatValue(edit.shown, edit.range.step)} onchange={(e) => typeValue(edit, e.currentTarget.value)} onblur={() => (typing = null)} onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter') && e.currentTarget.blur()} onpointerdown={(e) => e.stopPropagation()} />
      {:else}
        <span class="prop-value editable" role="slider" tabindex="0" aria-label={`${lane.label} value`} aria-valuenow={edit.shown} title="Drag to change (Shift ×10, Alt ×0.1), click to type" onpointerdown={(e) => startValue(e, edit)} onpointermove={moveValue} onpointerup={() => endValue(rowId)} onkeydown={(e) => e.key === 'Enter' && (typing = rowId)}>{formatValue(edit.shown, edit.range.step)}<em>{edit.unit}</em></span>
      {/if}
    </div>
    <div class="lane">
      {#each keys.slice(0, -1) as key, i (key.frame)}
        <button
          type="button"
          class="segment"
          title="Ease"
          aria-label={`Ease after ${lane.label} keyframe`}
          style={`left: ${(owner.from + key.frame) * ppf}px; width: ${(keys[i + 1].frame - key.frame) * ppf}px;`}
          onclick={(e) => openEase(e, owner, { clipId: owner.id, prop: lane.prop, frame: key.frame }, { clipId: owner.id, prop: lane.prop, frame: keys[i + 1].frame }, key.ease)}
        ></button>
      {/each}
      {#each keys as key (key.frame)}
        {@const ref = { clipId: owner.id, prop: lane.prop, frame: key.frame }}
        <div
          class="key"
          class:picked={keySelection.some((k) => sameKey(k, ref))}
          class:roving={key.roving}
          role="button"
          tabindex="-1"
          aria-label={`${lane.label} keyframe at ${owner.from + key.frame}`}
          data-key-frame={owner.from + key.frame}
          data-interp={key.out ?? Interp.Bezier}
          data-glyph={keyGlyph(key)}
          style={`left: ${(owner.from + key.frame) * ppf}px;`}
          onpointerdown={(e) => startKey(e, owner, ref)}
        ></div>
      {/each}
    </div>
  </div>
{/snippet}

<div class="timeline" bind:this={lanes} data-testid="motion-timeline" style={`--head: ${headPx}px;`} onpointerdowncapture={touchDown} onpointermovecapture={touchMove} onpointerupcapture={touchUp} onpointercancelcapture={touchUp}>
  <div class="inner" style={`width: ${width + headPx}px;`}>
    <div class="ruler" role="slider" tabindex="-1" aria-label="Playhead" aria-valuenow={frame} onpointerdown={startScrub}>
      <div class="corner">
        <input class="search" type="search" placeholder="Search layers" aria-label="Search layers" bind:value={filter} onpointerdown={(e) => e.stopPropagation()} />
        <button type="button" class="shy-toggle" class:on={hideShy} aria-pressed={hideShy} title="Hide shy tracks" onpointerdown={(e) => e.stopPropagation()} onclick={() => (hideShy = !hideShy)}><Ghost size={12} /></button>
      </div>
      {#each marks as mark (mark.frame)}
        <span class="tick" class:major={mark.label} style={`left: ${headPx + mark.frame * ppf}px;`}>
          {#if mark.label}<em>{mark.label}</em>{/if}
        </span>
      {/each}
      {#if shown.workArea}
        <span class="work-area" data-testid="work-area" style={`left: ${headPx + shown.workArea.from * ppf}px; width: ${(shown.workArea.to - shown.workArea.from) * ppf}px;`}></span>
      {/if}
      {#each markers as m (`${m.clipId}:${m.label}`)}
        <span class="marker" class:clip-marker={m.clipId} data-marker={m.label} title={m.label} style={`left: ${headPx + m.frame * ppf}px;`}></span>
      {/each}
      {#each beats as beat (beat)}<span class="beat" data-beat={beat} style={`left: ${headPx + beat * ppf}px;`}></span>{/each}
      <span class="playhead-head" style={`left: ${headPx + frame * ppf}px;`}></span>
    </div>

    {#if cameraShown}
      <div class="row layer camera-row" class:selected={camera} data-camera-track style={hueOf(ClipFamily.Camera)}>
        <div class="head" role="button" tabindex="-1" aria-label="Select the camera" onpointerdown={pickCamera}>
          <span class="indent"></span>
          {#if cameraOwner}
            <button type="button" class="twirl" aria-label="Show keyframes" aria-expanded={open.includes(CAMERA_LANE)} onpointerdown={(e) => e.stopPropagation()} onclick={() => (open = toggled(open, CAMERA_LANE))}>{#if open.includes(CAMERA_LANE)}<ChevronDown size={12} />{:else}<ChevronRight size={12} />{/if}</button>
          {:else}
            <span class="twirl"></span>
          {/if}
          <span class="swatch"></span>
          <span class="layer-name">Camera{#if shown.camera?.dof}<em> · depth of field</em>{/if}</span>
        </div>
        <div class="lane">
          <div
            class="bar camera-bar"
            class:selected={camera}
            class:ghost={!shown.camera}
            role="button"
            tabindex="0"
            aria-label="Camera"
            data-testid="camera-bar"
            style={`left: 0; width: ${Math.max(4, shown.durationInFrames * ppf)}px;`}
            onpointerdown={pickCamera}
          >
            <span class="kicker">Camera</span>
            <span class="label">{shown.camera ? `${cameraLanes(shown.camera).length} animated values${Object.keys(shown.camera.expressions).length ? ` · ƒ ${Object.keys(shown.camera.expressions).join(', ')}` : ''}` : 'Add a camera for 3D moves'}</span>
          </div>
        </div>
      </div>
      {#if cameraOwner && open.includes(CAMERA_LANE)}
        {#each cameraLanes(shown.camera) as lane (lane.prop)}{@render propRow(cameraOwner, lane, `${CAMERA_LANE}:${lane.prop}`)}{/each}
      {/if}
    {/if}

    {#each rows as row (row.kind + row.id)}
      {#if row.kind === RowKind.Group}
        {@const track = row.track}
        {@const family = trackFamily(track)}
        {@const index = shown.tracks.findIndex((t) => t.id === track.id)}
        <div class="row group" data-track-id={track.id} class:folded={folded.includes(track.id)} style={hueOf(family)}>
          <div class="head">
            <button type="button" class="twirl" aria-label={folded.includes(track.id) ? 'Expand track' : 'Collapse track'} aria-expanded={!folded.includes(track.id)} onclick={() => toggleFold(track.id)}>
              {#if folded.includes(track.id)}<ChevronRight size={12} />{:else}<ChevronDown size={12} />{/if}
            </button>
            <span class="group-name">{track.name || track.id}</span>
            <span class="count">{track.clips.length}</span>
            <span class="flags">
              <button type="button" title={track.hidden ? 'Show track' : 'Hide track'} aria-label={track.hidden ? 'Show track' : 'Hide track'} aria-pressed={!!track.hidden} data-flag="hide" class:on={track.hidden} onclick={() => flag(track.id, { hidden: !track.hidden }, track.hidden ? 'Showed a track' : 'Hid a track')}>{#if track.hidden}<EyeOff size={12} />{:else}<Eye size={12} />{/if}</button>
              <button type="button" title={track.locked ? 'Unlock track' : 'Lock track'} aria-label={track.locked ? 'Unlock track' : 'Lock track'} aria-pressed={!!track.locked} data-flag="lock" class:on={track.locked} onclick={() => flag(track.id, { locked: !track.locked }, track.locked ? 'Unlocked a track' : 'Locked a track')}>{#if track.locked}<Lock size={12} />{:else}<LockOpen size={12} />{/if}</button>
              <button type="button" title="Solo track" aria-label="Solo track" aria-pressed={solo.includes(track.id)} data-flag="solo" class:on={solo.includes(track.id)} onclick={() => (solo = toggled(solo, track.id))}><Headphones size={12} /></button>
              <button type="button" title="Shy track" aria-label="Shy track" aria-pressed={shy.includes(track.id)} data-flag="shy" class:on={shy.includes(track.id)} onclick={() => (shy = toggled(shy, track.id))}><Ghost size={12} /></button>
              <button type="button" title="Move track up" aria-label="Move track up" disabled={index <= 0} onclick={() => reorder(track.id, -1)}><ChevronUp size={12} /></button>
              <button type="button" title="Move track down" aria-label="Move track down" disabled={index === shown.tracks.length - 1} onclick={() => reorder(track.id, 1)}><ChevronDown size={12} /></button>
            </span>
          </div>
          <div class="lane" data-track-id={track.id}>
            {#each track.clips as clip (clip.id)}
              <span class="summary-bar" style={`left: ${clip.from * ppf}px; width: ${Math.max(2, clip.durationInFrames * ppf)}px; ${hueOf(familyOf(clip.component))}`}></span>
            {/each}
          </div>
        </div>
      {:else if row.kind === RowKind.Layer}
        {@const track = row.track}
        {@const clip = row.clip}
        {@const clipFamily = familyOf(clip.component)}
        {@const preview = CLIP_FAMILIES[clipFamily].preview}
        {@const url = assetOf(clip)}
        {@const wave = waveOf(clip)}
        {@const twirlable = lanesOf(clip).length > 0}
        <div class="row layer" data-layer={clip.id} data-track-id={track.id} class:selected={selection.includes(clip.id)} style={hueOf(clipFamily)}>
          <div class="head" role="button" tabindex="-1" aria-label={`Select ${layerName(clip, doc.comps)}`} onpointerdown={(e) => pickLayer(e, clip)}>
            <span class="indent" style={`width: ${12 + INDENT_PX * ancestorsOf(shown, clip.id).length}px;`}></span>
            {#if twirlable}
              <button type="button" class="twirl" aria-label="Show keyframes" aria-expanded={isOpen(clip)} onpointerdown={(e) => e.stopPropagation()} onclick={() => toggleOpen(clip.id)}>{#if isOpen(clip)}<ChevronDown size={12} />{:else}<ChevronRight size={12} />{/if}</button>
            {:else}
              <span class="twirl"></span>
            {/if}
            <span class="swatch"></span>
            <span class="layer-name" title={layerName(clip, doc.comps)}>{#if clip.parent}<em class="parent">↳ {parentName(clip)}</em>{/if}{layerName(clip, doc.comps)}</span>
            <span class="flags">
              {#if track.kind === TrackKind.Visual}
                <button type="button" class="whip" title="Drag onto another layer to parent this one to it" aria-label="Parent pick-whip" data-whip={clip.id} onpointerdown={(e) => startWhip(e, clip.id)}><Link2 size={12} /></button>
              {/if}
              <button type="button" title={clip.hidden ? 'Show layer' : 'Hide layer'} aria-label={clip.hidden ? 'Show layer' : 'Hide layer'} aria-pressed={!!clip.hidden} class:on={clip.hidden} onpointerdown={(e) => e.stopPropagation()} onclick={() => clipFlag(clip.id, { hidden: !clip.hidden }, clip.hidden ? 'Showed a layer' : 'Hid a layer')}>{#if clip.hidden}<EyeOff size={12} />{:else}<Eye size={12} />{/if}</button>
              <button type="button" title={clip.locked ? 'Unlock layer' : 'Lock layer'} aria-label={clip.locked ? 'Unlock layer' : 'Lock layer'} aria-pressed={!!clip.locked} class:on={clip.locked} onpointerdown={(e) => e.stopPropagation()} onclick={() => clipFlag(clip.id, { locked: !clip.locked }, clip.locked ? 'Unlocked a layer' : 'Locked a layer')}>{#if clip.locked}<Lock size={12} />{:else}<LockOpen size={12} />{/if}</button>
            </span>
          </div>
          <div class="lane" data-track-id={track.id}>
            <div
              class="bar"
              class:selected={selection.includes(clip.id)}
              class:muted={track.hidden || clip.hidden}
              class:locked={track.locked || clip.locked}
              data-clip-id={clip.id}
              data-family={clipFamily}
              role="button"
              tabindex="0"
              aria-label={`${COMPONENTS[clip.component].label} clip`}
              style={`left: ${clip.from * ppf}px; width: ${Math.max(4, clip.durationInFrames * ppf)}px;`}
              onpointerdown={(e) => startClip(e, clip, track.id)}
              ondblclick={() => openComp(clip)}
            >
              {#if url && preview === Preview.Thumb}
                <span class="thumbs" style={`background-image: url("${url}");`} aria-hidden="true"></span>
              {:else if url && preview === Preview.Filmstrip}
                <span class="strip" use:whenVisible={url} aria-hidden="true">
                  {#each stripTiles(clip, url) as tile, i (i)}<img src={tile} alt="" />{/each}
                </span>
              {/if}
              {#if wave}<svg class="wave" viewBox={`0 0 ${wave.width} 1`} preserveAspectRatio="none" aria-hidden="true"><path d={wave.path} /></svg>{/if}
              <span class="kicker">{COMPONENTS[clip.component].label}</span>
              <span class="label">{clipLabel(clip)}</span>
              {#if Object.keys(clip.expressions ?? {}).length}<span class="tag expr" data-expr-marker={clip.id} title={`Expressions: ${Object.keys(clip.expressions).join(', ')}`}>ƒ</span>{/if}
              {#if clip.mask}<span class="tag" title="Masked">mask</span>{/if}
              {#if clip.matte !== Matte.None}<span class="tag" title="Track matte">{clip.matte} matte</span>{/if}
              {#if !isOpen(clip)}
                {#each keyFrames(clip) as at (at)}<span class="key-dot" style={`left: ${at * ppf - 3}px;`}></span>{/each}
              {/if}
            </div>
            {#if selection.includes(clip.id)}
              {@const fades = fadeHandles(clip, shown.fps, ppf)}
              {#if fades.length}
                <svg class="fade-ramp" style={`left: ${clip.from * ppf}px; width: ${clip.durationInFrames * ppf}px;`} viewBox={`0 0 ${clip.durationInFrames * ppf} 1`} preserveAspectRatio="none" aria-hidden="true">
                  <polyline points={`0,1 ${fades[0].x - clip.from * ppf},0 ${fades[1].x - clip.from * ppf},0 ${clip.durationInFrames * ppf},1`} />
                </svg>
                {#each fades as fade (fade.edge)}
                  <div
                    class="fade"
                    data-fade={fade.edge}
                    data-fade-clip={clip.id}
                    role="slider"
                    tabindex="-1"
                    aria-label={FADE_LABEL[fade.edge]}
                    aria-valuenow={(clip.props as Record<string, number>)[fade.edge] ?? 0}
                    style={`left: ${fade.x}px;`}
                    onpointerdown={(e) => startClip(e, clip, track.id, FADE_DRAG[fade.edge])}
                  ></div>
                {/each}
              {/if}
            {/if}
            {#each edgeHandles([clip], ppf, selection) as handle (handle.grip)}
              <div
                class="grip"
                data-grip={handle.grip}
                data-grip-clip={handle.clipId}
                role="separator"
                aria-label={`Trim ${handle.grip}`}
                style={`left: ${handle.left}px; width: ${handle.width}px;`}
                onpointerdown={(e) => startClip(e, clip, track.id, GRIP_DRAG[handle.grip])}
              ></div>
            {/each}
          </div>
        </div>
      {:else}
        {@render propRow(row.clip, row.lane, row.id)}
      {/if}
    {/each}

    {#if shown.tracks.every((t) => !t.clips.length)}
      <div class="empty-drop" data-testid="timeline-empty">Press <b>+ Add</b> to place your first element</div>
    {/if}

    {#if easing}
      <div class="ease-at" style={`left: ${Math.max(headPx, easing.left - 120)}px; top: ${easing.top}px;`}>
        <EasePicker ease={easing.ease} kinds={segmentKinds(easing)} onpick={pickEase} onkind={pickKind} onclose={() => (easing = null)} />
      </div>
    {/if}

    {#if whip}
      <svg class="whip-line" aria-hidden="true"><line x1={whip.x0} y1={whip.y0} x2={whip.x} y2={whip.y} /></svg>
    {/if}

    <div class="playhead" style={`left: ${headPx + frame * ppf}px;`}></div>
  </div>
</div>

<style>
  .timeline {
    --row: 28px;
    --prop-row: 24px;
    --tint: 14%;
    position: relative;
    overflow: auto;
    background: var(--ui-bg);
    user-select: none;
    font-size: var(--ui-text-xs);
    color: var(--ui-ink);
    height: 100%;
  }

  :global([data-theme='dark']) .timeline {
    --tint: 22%;
  }

  .inner {
    position: relative;
    min-height: 100%;
  }

  .ruler {
    position: sticky;
    top: 0;
    z-index: 7;
    height: 28px;
    background: var(--ui-bg);
    border-bottom: 1px solid var(--ui-line);
    cursor: ew-resize;
  }

  .corner {
    position: sticky;
    float: left;
    left: 0;
    top: 0;
    z-index: 6;
    display: flex;
    align-items: center;
    gap: 4px;
    width: var(--head);
    height: 100%;
    padding: 0 6px;
    background: var(--ui-bg);
    border-right: 1px solid var(--ui-line);
    cursor: default;
  }

  .search {
    flex: 1;
    min-width: 0;
    height: 22px;
    padding: 0 6px;
    border: 1px solid transparent;
    border-radius: 0;
    background: var(--ui-surface);
    color: var(--ui-ink);
    font: inherit;
  }

  .search:hover {
    border-color: var(--ui-line-strong);
  }

  .search:focus {
    outline: none;
    border-color: var(--ui-accent);
  }

  .shy-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    color: var(--ui-ink-3);
  }

  .shy-toggle:hover {
    color: var(--ui-ink);
  }

  .shy-toggle.on {
    background: var(--ui-accent-wash);
    color: var(--ui-accent);
  }

  .tick {
    position: absolute;
    bottom: 0;
    width: 1px;
    height: 5px;
    background: var(--ui-grid);
    pointer-events: none;
  }

  .tick.major {
    height: 10px;
    background: var(--ui-ink-3);
  }

  .tick em {
    position: absolute;
    bottom: 11px;
    left: 4px;
    font-style: normal;
    font-family: var(--ui-mono);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    color: var(--ui-ink-3);
    white-space: nowrap;
  }

  .work-area {
    position: absolute;
    top: 0;
    height: 4px;
    background: color-mix(in srgb, var(--ui-accent) 50%, transparent);
    border-left: 2px solid var(--ui-accent);
    border-right: 2px solid var(--ui-accent);
    pointer-events: none;
  }

  .marker {
    position: absolute;
    bottom: 0;
    width: 8px;
    height: 8px;
    margin-left: -4px;
    background: var(--ui-warn);
    clip-path: polygon(0 0, 100% 0, 50% 100%);
    pointer-events: none;
  }

  .marker.clip-marker {
    background: #8a6cff;
  }

  .beat {
    position: absolute;
    top: 4px;
    width: 2px;
    height: 5px;
    margin-left: -1px;
    background: var(--ui-accent);
    pointer-events: none;
  }

  .playhead-head {
    position: absolute;
    bottom: 0;
    width: 11px;
    height: 10px;
    margin-left: -5px;
    background: var(--playhead);
    clip-path: polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%);
    pointer-events: none;
    z-index: 3;
  }

  .playhead {
    position: absolute;
    top: 28px;
    bottom: 0;
    width: 1px;
    background: var(--playhead);
    pointer-events: none;
    z-index: 4;
  }

  .row {
    position: relative;
    display: flex;
    height: var(--row);
  }

  .row > .head,
  .row > .lane {
    border-bottom: 1px solid var(--ui-line);
  }

  .row.prop {
    height: var(--prop-row);
    background: var(--ui-surface);
  }

  .head {
    position: sticky;
    left: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 4px;
    width: var(--head);
    flex-shrink: 0;
    padding-right: 4px;
    background: var(--ui-bg);
    border-right: 1px solid var(--ui-line);
    overflow: hidden;
  }

  .row.group > .head {
    background: var(--ui-surface);
    padding-left: 4px;
  }

  .row.group {
    background: var(--ui-surface);
  }

  .row.prop > .head {
    background: var(--ui-surface);
  }

  .row.layer:hover > .head {
    background: var(--ui-hover);
  }

  .row.layer.selected > .head {
    background: color-mix(in srgb, var(--ui-accent) 10%, var(--ui-bg));
  }

  .head button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 0;
    border-radius: 0;
    background: none;
    color: var(--ui-ink-3);
    cursor: pointer;
  }

  .indent {
    flex-shrink: 0;
    width: 12px;
  }

  .prop-indent {
    width: 46px;
  }

  .twirl {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 14px;
    height: 20px;
  }

  .head .twirl:hover {
    color: var(--ui-ink);
  }

  .swatch {
    flex-shrink: 0;
    width: 3px;
    height: 16px;
    background: var(--hue);
  }

  .group-name,
  .layer-name,
  .prop-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .group-name {
    flex: 0 0 auto;
    max-width: 96px;
    font-weight: 600;
  }

  .count {
    flex: 1;
    font-family: var(--ui-mono);
    font-size: 10px;
    color: var(--ui-ink-3);
  }

  .layer-name {
    padding-left: 4px;
    color: var(--ui-ink);
  }

  .layer-name em,
  .parent {
    font-style: normal;
    color: var(--ui-ink-3);
    margin-right: 4px;
  }

  .prop-name {
    color: var(--ui-ink-2);
  }

  .prop-value {
    flex-shrink: 0;
    font-family: var(--ui-mono);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--ui-accent);
  }

  .prop-value.editable {
    padding: 2px 4px;
    cursor: ew-resize;
    touch-action: none;
  }

  .prop-value.editable:hover {
    background: var(--ui-hover);
  }

  .prop-value em {
    margin-left: 2px;
    font-style: normal;
    font-size: 10px;
    color: var(--ui-ink-3);
  }

  .prop-input {
    width: 64px;
    height: 20px;
    padding: 0 4px;
    border: 1px solid var(--ui-accent);
    border-radius: 0;
    background: var(--ui-bg);
    color: var(--ui-ink);
    font-family: var(--ui-mono);
    font-size: 11px;
    text-align: right;
  }

  .mark {
    width: 14px;
    height: 14px;
  }

  .mark::before {
    content: '';
    width: 8px;
    height: 8px;
    transform: rotate(45deg);
    border: 1.5px solid var(--ui-ink-3);
  }

  .mark[data-mark='here']::before {
    border-color: var(--ui-accent);
    background: var(--ui-accent);
  }

  .mark[data-mark='animated']::before {
    background: linear-gradient(135deg, var(--ui-ink-3) 50%, transparent 50%);
  }

  .flags {
    display: inline-flex;
    gap: 1px;
    flex-shrink: 0;
  }

  .flags button {
    width: 20px;
    height: 20px;
  }

  .flags button:not(.on) {
    visibility: hidden;
  }

  .row:hover .flags button,
  .head:focus-within .flags button {
    visibility: visible;
  }

  .flags button:hover:not(:disabled) {
    color: var(--ui-ink);
    background: var(--ui-hover);
  }

  .flags button:disabled {
    opacity: 0.4;
  }

  .flags button.on {
    color: var(--ui-accent);
  }

  .lane {
    position: relative;
    flex: 1;
  }

  .summary-bar {
    position: absolute;
    top: 50%;
    height: 6px;
    margin-top: -3px;
    background: color-mix(in srgb, var(--hue) 45%, var(--ui-surface));
    pointer-events: none;
  }

  .row.group:not(.folded) .summary-bar {
    height: 2px;
    margin-top: -1px;
    background: color-mix(in srgb, var(--hue) 30%, var(--ui-surface));
  }

  .bar {
    position: absolute;
    top: 3px;
    height: calc(var(--row) - 7px);
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 6px 0 8px;
    overflow: hidden;
    background: color-mix(in srgb, var(--hue) var(--tint), var(--ui-bg));
    border: 1px solid color-mix(in srgb, var(--hue) 35%, var(--ui-bg));
    border-left: 3px solid var(--hue);
    cursor: grab;
    white-space: nowrap;
  }

  .bar:hover {
    border-color: color-mix(in srgb, var(--hue) 60%, var(--ui-bg));
    border-left-color: var(--hue);
  }

  .bar.selected {
    outline: 2px solid var(--ui-accent);
    outline-offset: -1px;
    z-index: 2;
  }

  .bar.selected::before,
  .bar.selected::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 5px;
    background: var(--ui-accent);
  }

  .bar.selected::before {
    left: 0;
  }

  .bar.selected::after {
    right: 0;
  }

  .bar.muted {
    opacity: 0.4;
  }

  .bar.locked {
    background-image: repeating-linear-gradient(45deg, transparent 0 4px, color-mix(in srgb, var(--hue) 25%, transparent) 4px 6px);
    cursor: not-allowed;
  }

  .kicker {
    flex-shrink: 0;
    position: relative;
    font-family: var(--ui-mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: color-mix(in srgb, var(--hue) 80%, var(--ui-ink));
  }

  .label {
    position: relative;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--ui-ink);
  }

  .tag {
    position: relative;
    flex-shrink: 0;
    font-family: var(--ui-mono);
    font-size: 9px;
    color: var(--ui-ink-3);
  }

  .tag.expr {
    color: var(--ui-accent);
  }

  .key-dot {
    position: absolute;
    bottom: 1px;
    width: 5px;
    height: 5px;
    margin-left: -2.5px;
    transform: rotate(45deg);
    background: var(--ui-ink-3);
    pointer-events: none;
  }

  .thumbs,
  .strip {
    position: absolute;
    inset: 0;
    opacity: 0.35;
    pointer-events: none;
  }

  .thumbs {
    background-size: auto 100%;
    background-repeat: repeat-x;
  }

  .strip {
    display: flex;
  }

  .strip img {
    height: 100%;
    width: auto;
    flex-shrink: 0;
  }

  .wave {
    position: absolute;
    inset: 2px 0;
    width: 100%;
    height: calc(100% - 4px);
    pointer-events: none;
  }

  .wave path {
    fill: color-mix(in srgb, var(--hue) 55%, transparent);
  }

  .camera-bar {
    left: 0;
  }

  .camera-bar.ghost {
    background: transparent;
    border-style: dashed;
    border-left-style: solid;
  }

  .camera-bar.ghost .label {
    color: var(--ui-ink-3);
  }

  .fade-ramp {
    position: absolute;
    top: 3px;
    height: calc(var(--row) - 7px);
    pointer-events: none;
    z-index: 3;
  }

  .fade-ramp polyline {
    fill: none;
    stroke: var(--ui-accent);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .fade {
    position: absolute;
    top: 3px;
    width: 7px;
    height: 7px;
    margin-left: -3.5px;
    background: var(--ui-bg);
    border: 1.5px solid var(--ui-accent);
    cursor: ew-resize;
    z-index: 4;
  }

  .grip {
    position: absolute;
    top: 3px;
    height: calc(var(--row) - 7px);
    cursor: ew-resize;
    z-index: 3;
  }

  .whip {
    cursor: crosshair;
  }

  .whip-line {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9;
    overflow: visible;
  }

  .whip-line line {
    stroke: var(--ui-accent);
    stroke-width: 1.5;
  }

  .segment {
    position: absolute;
    top: 50%;
    height: 9px;
    margin-top: -4.5px;
    border: 0;
    border-radius: 0;
    background: none;
    cursor: pointer;
  }

  .segment::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 4px;
    height: 1px;
    background: var(--ui-grid);
  }

  .segment:hover::after {
    background: var(--ui-accent);
  }

  .key {
    position: absolute;
    top: 50%;
    width: 9px;
    height: 9px;
    margin: -4.5px 0 0 -4.5px;
    transform: rotate(45deg);
    background: var(--ui-bg);
    border: 1.5px solid var(--ui-ink-2);
    cursor: grab;
    z-index: 1;
  }

  .key[data-glyph='square'] {
    transform: none;
  }

  .key[data-glyph='circle'] {
    transform: none;
    clip-path: circle(50%);
  }

  .key.roving {
    border-style: dashed;
  }

  .key:hover {
    border-color: var(--ui-accent);
  }

  .key.picked {
    background: var(--ui-accent);
    border-color: var(--ui-accent);
  }

  .empty-drop {
    position: sticky;
    left: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: min(480px, calc(100vw - 48px));
    height: 56px;
    margin: 12px;
    border: 1px dashed var(--ui-line-strong);
    background: var(--ui-bg);
    color: var(--ui-ink-3);
    font-size: var(--ui-text-sm);
    z-index: 5;
  }

  .empty-drop b {
    margin: 0 4px;
    color: var(--ui-ink-2);
    font-weight: 600;
  }

  .ease-at {
    position: absolute;
    z-index: 10;
  }

  @media (hover: none) {
    .row.group .flags button,
    .row.layer.selected .flags button {
      visibility: visible;
    }

    .row.layer:not(.selected) .flags {
      display: none;
    }
  }

  @media (pointer: coarse) {
    .timeline {
      --row: 44px;
      --prop-row: 40px;
    }

    .twirl,
    .flags button,
    .mark {
      width: 32px;
      height: 40px;
    }

    .grip {
      min-width: 16px;
    }

    .key {
      width: 14px;
      height: 14px;
      margin: -7px 0 0 -7px;
    }

    .ruler {
      height: 36px;
    }

    .playhead {
      top: 36px;
    }
  }
</style>
