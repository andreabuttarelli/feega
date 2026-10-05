<script lang="ts">
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Type from '@lucide/svelte/icons/type';
  import ImageIcon from '@lucide/svelte/icons/image';
  import Clapperboard from '@lucide/svelte/icons/clapperboard';
  import AudioLines from '@lucide/svelte/icons/audio-lines';
  import Square from '@lucide/svelte/icons/square';
  import Box from '@lucide/svelte/icons/box';
  import Code from '@lucide/svelte/icons/code';
  import Crosshair from '@lucide/svelte/icons/crosshair';
  import Video from '@lucide/svelte/icons/video';
  import SquareDashed from '@lucide/svelte/icons/square-dashed';
  import { tick, type Component } from 'svelte';
  import { CLIP_FAMILIES, ClipFamily, Preview, familyOf, tileFrames } from '$lib/motion/track-style';
  import { filmstrip, type Strip } from '$lib/motion/filmstrip';
  import { COMPONENTS, TrackKind } from '$lib/motion/components';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { ClipEdge, moveClip, moveKeyframes, moveTrack, setKeyEase, setKeyInterp, trimClip, type KeyRef, type OpResult } from '$lib/motion/timeline';
  import { withParams } from '$lib/motion/custom/params';
  import { Grip, KeySide, Reveal, Snap, edgeHandles, frameAt, keyLanes, pxPerFrame, rulerTicks, snapped, stackRows, type KeyLane } from '$lib/motion/timeline-view';
  import { MASK_KINDS, Matte } from '$lib/motion/mask';
  import type { MotionTrack } from '$lib/motion/doc';
  import { Interp, Source, type EaseSpec, type Keyframe } from '$lib/motion/keyframes';
  import { CAMERA_LANE } from '$lib/motion/camera';
  import { cameraLanes } from '$lib/motion/camera-ops';
  import { ancestorsOf } from '$lib/motion/parent';
  import { setParent } from '$lib/motion/parent-ops';
  import EasePicker from './EasePicker.svelte';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import Lock from '@lucide/svelte/icons/lock';
  import LockOpen from '@lucide/svelte/icons/lock-open';
  import Headphones from '@lucide/svelte/icons/headphones';
  import Ghost from '@lucide/svelte/icons/ghost';
  import { allMarkers, isLocked, setTrackFlags, shownTracks } from '$lib/motion/organize';
  import { PEAKS_PER_SECOND, clipPeaks, wavePath } from '$lib/motion/waveform';
  import { FadeEdge, dragFade, fadeHandles } from '$lib/motion/fade-handles';

  const HEADER_PX = 176;
  const COMPACT_HEADER_PX = 112;
  const COMPACT_BELOW_PX = 760;
  const ROW_PX = 34;
  const FOLDED_ROW_PX = 12;
  const LANE_PAD_PX = 6;
  const TILE_PX = 64;
  const MAX_TILES = 48;

  const FAMILY_ICONS: Record<ClipFamily, Component> = {
    [ClipFamily.Text]: Type,
    [ClipFamily.Image]: ImageIcon,
    [ClipFamily.Video]: Clapperboard,
    [ClipFamily.Audio]: AudioLines,
    [ClipFamily.Shape]: Square,
    [ClipFamily.ThreeD]: Box,
    [ClipFamily.Custom]: Code,
    [ClipFamily.Null]: Crosshair,
    [ClipFamily.Camera]: Video,
    [ClipFamily.Mask]: SquareDashed
  };

  const KEY_ROW_PX = 20;
  const DIAMOND_PX = 10;
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
    zoom,
    snap,
    waveforms = {},
    beats = [],
    assetUrls = {},
    reveal = Reveal.Animated,
    onchange
  }: { doc: MotionDoc; frame?: number; selection?: string[]; keySelection?: KeyRef[]; camera?: boolean; zoom: number; snap: Snap; waveforms?: Record<string, number[]>; beats?: number[]; assetUrls?: Record<string, string>; reveal?: Reveal; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  let folded = $state<string[]>([]);
  let solo = $state<string[]>([]);
  let shy = $state<string[]>([]);
  let hideShy = $state(false);
  let filter = $state('');
  let viewportWidth = $state(1440);
  const headPx = $derived(viewportWidth < COMPACT_BELOW_PX ? COMPACT_HEADER_PX : HEADER_PX);
  let strips = $state<Record<string, Strip>>({});

  let collapsed = $state<string[]>([]);
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
  const ticks = $derived(rulerTicks(shown.durationInFrames, zoom, doc.fps));

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

  function toggleLanes(e: Event, clipId: string) {
    e.stopPropagation();
    collapsed = collapsed.includes(clipId) ? collapsed.filter((id) => id !== clipId) : [...collapsed, clipId];
    void revealLanes(clipId);
  }

  function showLanes(e: Event, clipId: string) {
    e.stopPropagation();
    selection = [clipId];
    collapsed = collapsed.filter((id) => id !== clipId);
    void revealLanes(clipId);
  }

  async function revealLanes(clipId: string) {
    await tick();
    lanes?.querySelector(`[data-key-lane^="${clipId}:"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function laneClips(track: MotionTrack): MotionClip[] {
    return (track.clips as MotionClip[]).filter((c) => selection.includes(c.id) && !collapsed.includes(c.id) && keyLanes(withParams(shown, c), reveal).length > 0);
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

  function parentLabel(clip: MotionClip): string {
    const parent = clip.parent ? shown.tracks.flatMap((t) => t.clips).find((c) => c.id === clip.parent) : null;
    return parent ? `↳ ${clipLabel(parent as MotionClip)} · ` : '';
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

  function rowPx(track: MotionTrack): number {
    return folded.includes(track.id) ? FOLDED_ROW_PX : ROW_PX;
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

  function clipLabel(clip: MotionClip): string {
    const p = clip.props as { text?: string; title?: string; name?: string };
    const label = clip.component === 'Custom' ? p.name : undefined;
    return label ?? p.text?.split('\n')[0] ?? p.title ?? COMPONENTS[clip.component].label;
  }
</script>

<svelte:window bind:innerWidth={viewportWidth} onpointermove={onMove} onpointerup={onUp} />

  {#snippet keyLane(clip: KeyOwner, lane: { prop: string; label: string })}
    {@const keys = clip.keyframes[lane.prop] ?? []}
    <div class="lane sub" data-key-lane={`${clip.id}:${lane.prop}`} style={`height: ${KEY_ROW_PX}px;`}>
      <div class="head" style={`width: ${headPx}px;`}><span class="name prop">{lane.label}</span></div>
      <div class="clips">
        {#each keys.slice(0, -1) as key, i (key.frame)}
          <button
            type="button"
            class="segment"
            title="Ease"
            aria-label={`Ease after ${lane.label} keyframe`}
            style={`left: ${(clip.from + key.frame) * ppf}px; width: ${(keys[i + 1].frame - key.frame) * ppf}px;`}
            onclick={(e) => openEase(e, clip, { clipId: clip.id, prop: lane.prop, frame: key.frame }, { clipId: clip.id, prop: lane.prop, frame: keys[i + 1].frame }, key.ease)}
          ></button>
        {/each}
        {#each keys as key (key.frame)}
          {@const ref = { clipId: clip.id, prop: lane.prop, frame: key.frame }}
          <div
            class="diamond"
            class:picked={keySelection.some((k) => sameKey(k, ref))}
            role="button"
            tabindex="-1"
            aria-label={`${lane.label} keyframe at ${clip.from + key.frame}`}
            data-key-frame={clip.from + key.frame}
            data-interp={key.out ?? Interp.Bezier}
            class:roving={key.roving}
            style={`left: ${(clip.from + key.frame) * ppf - DIAMOND_PX / 2}px; width: ${DIAMOND_PX}px; height: ${DIAMOND_PX}px; top: ${(KEY_ROW_PX - DIAMOND_PX) / 2}px;`}
            onpointerdown={(e) => startKey(e, clip, ref)}
          ></div>
        {/each}
      </div>
    </div>
  {/snippet}

<div class="timeline" bind:this={lanes} data-testid="motion-timeline">
  <div class="inner" style={`width: ${width + headPx}px;`}>
    <div class="ruler" role="slider" tabindex="-1" aria-label="Playhead" aria-valuenow={frame} onpointerdown={startScrub}>
      <div class="corner" style={`width: ${headPx}px;`}>
        <input class="search" type="search" placeholder="Search layers" aria-label="Search layers" bind:value={filter} onpointerdown={(e) => e.stopPropagation()} />
        <button type="button" class="shy-toggle" class:on={hideShy} aria-pressed={hideShy} title="Hide shy tracks" onpointerdown={(e) => e.stopPropagation()} onclick={() => (hideShy = !hideShy)}><Ghost size={12} /></button>
      </div>
      {#if shown.workArea}
        <span class="work-area" data-testid="work-area" style={`left: ${headPx + shown.workArea.from * ppf}px; width: ${(shown.workArea.to - shown.workArea.from) * ppf}px;`}></span>
      {/if}
      {#each markers as m (`${m.clipId}:${m.label}`)}
        <span class="marker" class:clip-marker={m.clipId} data-marker={m.label} title={m.label} style={`left: ${headPx + m.frame * ppf}px;`}><em>{m.label}</em></span>
      {/each}
      {#each ticks as tick (tick.frame)}
        <span class="tick" class:major={tick.label} style={`left: ${headPx + tick.frame * ppf}px;`}>
          {#if tick.label}<em>{tick.label}</em>{/if}
        </span>
      {/each}
      {#each beats as beat (beat)}<span class="beat" data-beat={beat} style={`left: ${headPx + beat * ppf}px;`}></span>{/each}
    </div>

    <div class="lane camera-track" data-camera-track style={`height: ${ROW_PX + 2 * LANE_PAD_PX}px; ${hueOf(ClipFamily.Camera)}`}>
      <div class="head" style={`width: ${headPx}px;`}><span class="fold-space"></span><span class="chip"><Video size={12} /></span><span class="name">Camera</span></div>
      <div class="clips">
        <div
          class="bar camera-bar"
          class:selected={camera}
          class:ghost={!shown.camera}
          role="button"
          tabindex="0"
          aria-label="Camera"
          data-testid="camera-bar"
          style={`left: 0; width: ${Math.max(4, shown.durationInFrames * ppf)}px; top: ${LANE_PAD_PX}px; height: ${ROW_PX - 2}px;`}
          onpointerdown={pickCamera}
        >
          <span class="kind">Camera{#if shown.camera?.dof}<span class="tag"> · depth of field</span>{/if}</span>
          <span class="label">{shown.camera ? `${cameraLanes(shown.camera).length} animated values${Object.keys(shown.camera.expressions).length ? ` · = ${Object.keys(shown.camera.expressions).join(', ')}` : ''}` : 'Add a camera for 3D moves'}</span>
        </div>
      </div>
    </div>
    {#if cameraOwner}
      {#each cameraLanes(shown.camera) as lane (lane.prop)}{@render keyLane(cameraOwner, lane)}{/each}
    {/if}

    {#each tracks as track, index (track.id)}
      {@const rows = stackRows(track.clips)}
      {@const rowCount = Math.max(1, ...Object.values(rows).map((r) => r + 1))}
      {@const row = rowPx(track)}
      {@const family = trackFamily(track)}
      {@const TrackIcon = FAMILY_ICONS[family]}
      <div class="lane track" data-track-id={track.id} class:alt={index % 2 === 1} class:folded={folded.includes(track.id)} style={`height: ${rowCount * row + 2 * LANE_PAD_PX}px; ${hueOf(family)}`}>
        <div class="head" style={`width: ${headPx}px;`}>
          <button type="button" class="fold" aria-label={folded.includes(track.id) ? 'Expand track' : 'Collapse track'} aria-expanded={!folded.includes(track.id)} onclick={() => toggleFold(track.id)}>
            {#if folded.includes(track.id)}<ChevronRight size={12} />{:else}<ChevronDown size={12} />{/if}
          </button>
          <span class="chip" title={CLIP_FAMILIES[family].label}><TrackIcon size={12} /></span>
          <span class="name">{track.name || track.id}</span>
          <span class="flags">
            <button type="button" aria-label={track.hidden ? 'Show track' : 'Hide track'} aria-pressed={!!track.hidden} data-flag="hide" class:on={track.hidden} onclick={() => flag(track.id, { hidden: !track.hidden }, track.hidden ? 'Showed a track' : 'Hid a track')}>{#if track.hidden}<EyeOff size={12} />{:else}<Eye size={12} />{/if}</button>
            <button type="button" aria-label={track.locked ? 'Unlock track' : 'Lock track'} aria-pressed={!!track.locked} data-flag="lock" class:on={track.locked} onclick={() => flag(track.id, { locked: !track.locked }, track.locked ? 'Unlocked a track' : 'Locked a track')}>{#if track.locked}<Lock size={12} />{:else}<LockOpen size={12} />{/if}</button>
            <button type="button" aria-label="Solo track" aria-pressed={solo.includes(track.id)} data-flag="solo" class:on={solo.includes(track.id)} onclick={() => (solo = toggled(solo, track.id))}><Headphones size={12} /></button>
            <button type="button" aria-label="Shy track" aria-pressed={shy.includes(track.id)} data-flag="shy" class:on={shy.includes(track.id)} onclick={() => (shy = toggled(shy, track.id))}><Ghost size={12} /></button>
          </span>
          <span class="order">
            <button type="button" aria-label="Move track up" disabled={index === 0} onclick={() => reorder(track.id, -1)}><ChevronUp size={12} /></button>
            <button type="button" aria-label="Move track down" disabled={index === shown.tracks.length - 1} onclick={() => reorder(track.id, 1)}><ChevronDown size={12} /></button>
          </span>
        </div>
        <div class="clips" data-track-id={track.id}>
          {#each track.clips as clip (clip.id)}
            {@const wave = waveOf(clip as MotionClip)}
            {@const clipFamily = familyOf(clip.component)}
            {@const preview = CLIP_FAMILIES[clipFamily].preview}
            {@const url = assetOf(clip as MotionClip)}
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
              style={`left: ${clip.from * ppf}px; width: ${Math.max(4, clip.durationInFrames * ppf)}px; top: ${LANE_PAD_PX + rows[clip.id] * row}px; height: ${row - 2}px; ${hueOf(clipFamily)}`}
              onpointerdown={(e) => startClip(e, clip as MotionClip, track.id)}
            >
              {#if url && preview === Preview.Thumb}
                <span class="thumbs" style={`background-image: url("${url}");`} aria-hidden="true"></span>
              {:else if url && preview === Preview.Filmstrip}
                <span class="strip" use:whenVisible={url} aria-hidden="true">
                  {#each stripTiles(clip as MotionClip, url) as tile, i (i)}<img src={tile} alt="" />{/each}
                </span>
              {/if}
              <span class="kind">
                {COMPONENTS[clip.component].label}
                {#if Object.keys(clip.keyframes).length}
                  <button type="button" class="lanes-toggle" aria-label="Show keyframes" aria-expanded={selection.includes(clip.id) && !collapsed.includes(clip.id)} onpointerdown={(e) => e.stopPropagation()} onclick={(e) => (selection.includes(clip.id) ? toggleLanes(e, clip.id) : showLanes(e, clip.id))}>◆</button>
                {/if}
                {#if Object.keys(clip.expressions ?? {}).length}<span class="tag expr" data-expr-marker={clip.id} title={`Expressions: ${Object.keys(clip.expressions).join(', ')}`}>· = {Object.keys(clip.expressions).join(', ')}</span>{/if}
                {#if clip.mask}<span class="tag" title="Masked">· mask</span>{/if}
                {#if clip.matte !== Matte.None}<span class="tag" title="Track matte">· {clip.matte} matte</span>{/if}
              </span>
              <span class="label" style={`padding-left: ${INDENT_PX * ancestorsOf(shown, clip.id).length}px;`}>{#if clip.parent}<em class="parent">{parentLabel(clip as MotionClip)}</em> {/if}{clipLabel(clip as MotionClip)}</span>
              {#if track.kind === TrackKind.Visual}
                <button type="button" class="whip" title="Drag onto another clip to parent this one to it" aria-label="Parent pick-whip" data-whip={clip.id} onpointerdown={(e) => startWhip(e, clip.id)}>@</button>
              {/if}
              {#if wave}<svg class="wave" viewBox={`0 0 ${wave.width} 1`} preserveAspectRatio="none" aria-hidden="true"><path d={wave.path} /></svg>{/if}
            </div>
          {/each}
          {#each track.clips.filter((c) => selection.includes(c.id)) as clip (clip.id)}
            {@const fades = fadeHandles(clip as MotionClip, shown.fps, ppf)}
            {#if fades.length}
              {@const top = LANE_PAD_PX + rows[clip.id] * row}
              <svg class="fade-ramp" style={`left: ${clip.from * ppf}px; top: ${top}px; width: ${clip.durationInFrames * ppf}px; height: ${row - 2}px;`} viewBox={`0 0 ${clip.durationInFrames * ppf} 1`} preserveAspectRatio="none" aria-hidden="true">
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
                  style={`left: ${fade.x}px; top: ${top}px;`}
                  onpointerdown={(e) => startClip(e, clip as MotionClip, track.id, FADE_DRAG[fade.edge])}
                ></div>
              {/each}
            {/if}
          {/each}
          {#each edgeHandles(track.clips, ppf, selection) as handle (`${handle.clipId}-${handle.grip}`)}
            <div
              class="grip"
              data-grip={handle.grip}
              data-grip-clip={handle.clipId}
              role="separator"
              aria-label={`Trim ${handle.grip}`}
              style={`left: ${handle.left}px; width: ${handle.width}px; top: ${LANE_PAD_PX + rows[handle.clipId] * row}px; height: ${row - 2}px;`}
              onpointerdown={(e) => startClip(e, clipById(handle.clipId), track.id, GRIP_DRAG[handle.grip])}
            ></div>
          {/each}
        </div>
      </div>
      {#each laneClips(track) as clip (clip.id)}
        {@const all = keyLanes(withParams(shown, clip), reveal)}
        {@const masked = all.filter((l) => l.source === Source.Mask)}
        {#each all.filter((l) => l.source !== Source.Mask) as lane (lane.prop)}{@render keyLane(clip, lane)}{/each}
        {#if masked.length}
          <div class="lane sub group" data-mask-lanes={clip.id} style={`height: ${KEY_ROW_PX}px;`}>
            <div class="head" style={`width: ${headPx}px;`}><span class="name prop">Mask{clip.mask ? ` · ${MASK_KINDS[clip.mask.kind].label}` : ''}</span></div>
            <div class="clips"></div>
          </div>
          {#each masked as lane (lane.prop)}{@render keyLane(clip, lane)}{/each}
        {/if}
      {/each}
    {/each}

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
    position: relative;
    overflow: auto;
    background: var(--ui-bg);
    border-top: 1px solid var(--ui-line);
    user-select: none;
    font-size: var(--ui-text-xs);
    color: var(--ui-ink);
    height: 100%;
  }

  .inner {
    position: relative;
    min-height: 100%;
  }

  .ruler {
    position: sticky;
    top: 0;
    z-index: 3;
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
    height: 100%;
    background: var(--ui-bg);
    border-right: 1px solid var(--ui-line);
    z-index: 6;
  }

  .beat {
    position: absolute;
    top: 0;
    width: 2px;
    height: 6px;
    margin-left: -1px;
    background: var(--ui-accent);
    pointer-events: none;
  }

  .tick {
    position: absolute;
    bottom: 0;
    width: 1px;
    height: 4px;
    background: var(--ui-line-strong);
  }

  .tick.major {
    height: 8px;
    background: var(--ui-ink-3);
  }

  .tick em {
    position: absolute;
    bottom: 10px;
    left: 4px;
    font-style: normal;
    font-family: var(--ui-mono);
    font-size: 10px;
    color: var(--ui-ink-3);
    white-space: nowrap;
  }

  .lane {
    position: relative;
    display: flex;
    border-bottom: 1px solid var(--ui-line);
  }

  .lane.alt {
    background: var(--ui-surface);
  }

  .head {
    position: sticky;
    left: 0;
    z-index: 5;
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 12px 8px 0 4px;
    margin-bottom: -1px;
    background: var(--ui-bg);
    border-right: 1px solid var(--ui-line);
    border-bottom: 1px solid var(--ui-line);
    flex-shrink: 0;
  }

  @media (max-width: 760px) {
    .head .chip,
    .head .order {
      display: none;
    }
  }

  .lane.sub > .head {
    align-items: center;
    padding-top: 0;
  }

  .lane.alt > .head {
    background: var(--ui-surface);
  }

  .head .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--ui-text-sm);
    font-weight: 500;
  }

  .head button {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    color: var(--ui-ink-3);
  }

  .head button:hover:not(:disabled) {
    color: var(--ui-ink);
    background: var(--ui-hover);
  }

  .head button:disabled {
    opacity: 0.3;
  }

  .fold-space {
    width: 18px;
    flex-shrink: 0;
  }

  .chip {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    background: color-mix(in srgb, var(--hue) 14%, transparent);
    color: var(--hue);
  }

  .order {
    display: flex;
    opacity: 0;
    transition: opacity 120ms;
  }

  .head:hover .order,
  .head:focus-within .order {
    opacity: 1;
  }

  .clips {
    position: relative;
    flex: 1;
  }

  .bar {
    position: absolute;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1px;
    padding: 0 8px 0 10px;
    overflow: hidden;
    background: color-mix(in srgb, var(--hue) 10%, var(--ui-bg));
    border: 1px solid color-mix(in srgb, var(--hue) 30%, transparent);
    box-shadow: inset 3px 0 0 var(--hue);
    cursor: grab;
    white-space: nowrap;
    transition: background 120ms;
  }

  .bar:hover {
    background: color-mix(in srgb, var(--hue) 16%, var(--ui-bg));
  }

  .bar.selected {
    border-color: var(--ui-accent);
    outline: 1px solid var(--ui-accent);
    z-index: 1;
  }

  .thumbs,
  .strip {
    position: absolute;
    inset: 0 0 0 3px;
    pointer-events: none;
  }

  .thumbs {
    background-repeat: repeat-x;
    background-size: auto 100%;
    opacity: 0.9;
  }

  .strip {
    display: flex;
    overflow: hidden;
  }

  .strip img {
    flex: 0 0 64px;
    width: 64px;
    height: 100%;
    object-fit: cover;
    border-right: 1px solid color-mix(in srgb, #000 25%, transparent);
  }

  .thumbs ~ .kind,
  .thumbs ~ .label,
  .strip ~ .kind,
  .strip ~ .label {
    position: relative;
    align-self: flex-start;
    max-width: 100%;
    padding: 0 4px;
    background: color-mix(in srgb, var(--ui-bg) 88%, transparent);
  }

  .bar .kind {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--ui-mono);
    font-size: 9px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--hue) 75%, var(--ui-ink));
  }

  .bar .label {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: var(--ui-text-sm);
    color: var(--ui-ink);
  }

  .lane.folded .bar .kind,
  .lane.folded .bar .label,
  .lane.folded .bar .whip,
  .lane.folded .bar .strip,
  .lane.folded .bar .thumbs {
    display: none;
  }

  .wave {
    position: absolute;
    inset: 4px 0 4px 3px;
    width: calc(100% - 3px);
    height: calc(100% - 8px);
    pointer-events: none;
    opacity: 0.55;
  }

  .wave path {
    stroke: var(--hue);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }

  .fade-ramp {
    position: absolute;
    z-index: 2;
    pointer-events: none;
    overflow: visible;
  }

  .fade-ramp polyline {
    fill: none;
    stroke: var(--ui-accent);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }

  .fade {
    position: absolute;
    z-index: 3;
    width: 8px;
    height: 8px;
    margin-left: -4px;
    background: var(--ui-accent);
    cursor: ew-resize;
  }

  .grip {
    position: absolute;
    z-index: 2;
    cursor: ew-resize;
  }

  .grip:hover {
    background: color-mix(in srgb, var(--ui-accent) 45%, transparent);
  }

  .whip {
    position: absolute;
    z-index: 3;
    right: 8px;
    top: 3px;
    width: 14px;
    height: 14px;
    font-size: 10px;
    line-height: 14px;
    color: var(--ui-ink-3);
    cursor: crosshair;
    opacity: 0;
  }

  .bar:hover .whip,
  .bar.selected .whip {
    opacity: 1;
  }

  .whip:hover {
    color: var(--ui-accent);
  }

  .parent {
    font-style: normal;
    color: var(--ui-ink-3);
  }

  .whip-line {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 7;
    overflow: visible;
  }

  .whip-line line {
    stroke: var(--ui-accent);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }

  .camera-bar {
    cursor: pointer;
  }

  .camera-bar.ghost {
    background: transparent;
    border-style: dashed;
    box-shadow: none;
  }

  .camera-bar.ghost .label {
    color: var(--ui-ink-3);
  }

  .lane.sub {
    background: var(--ui-surface);
  }

  .bar .tag {
    color: var(--ui-ink-2);
    text-transform: none;
  }

  .lane.group {
    --hue: #978365;
  }

  .lane.group .prop {
    font-family: var(--ui-mono);
    font-size: 10px;
    text-transform: uppercase;
    color: var(--hue);
  }

  .head .prop {
    padding-left: 28px;
    font-weight: 400;
    color: var(--ui-ink-2);
  }

  .segment {
    position: absolute;
    top: 50%;
    height: 8px;
    transform: translateY(-50%);
    cursor: pointer;
  }

  .segment::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    border-top: 1px solid var(--ui-line-strong);
  }

  .segment:hover::after {
    border-top-color: var(--ui-accent);
  }

  .diamond {
    position: absolute;
    z-index: 2;
    background: var(--ui-bg);
    border: 1.5px solid var(--ui-ink-2);
    transform: rotate(45deg) scale(0.75);
    cursor: ew-resize;
  }

  .diamond[data-interp='hold'] {
    transform: scale(0.75);
  }

  .diamond[data-interp='auto'],
  .diamond[data-interp='continuous'] {
    transform: scale(0.8);
    clip-path: polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%);
  }

  .diamond.roving {
    border-style: dashed;
  }

  .diamond:hover {
    border-color: var(--ui-ink);
  }

  .diamond.picked {
    background: var(--ui-accent);
    border-color: var(--ui-accent);
  }

  .tag.expr {
    font-family: var(--ui-mono);
  }

  .lanes-toggle {
    font-size: 9px;
    color: var(--ui-ink-3);
  }

  .lanes-toggle[aria-expanded='true'] {
    color: var(--ui-accent);
  }

  .ease-at {
    position: absolute;
    z-index: 6;
  }

  .flags {
    display: flex;
    flex-shrink: 0;
  }

  .flags button:not(.on) {
    display: none;
  }

  .head:hover .flags button,
  .head:focus-within .flags button {
    display: grid;
  }

  .flags button.on {
    color: var(--ui-accent);
  }

  .bar.muted {
    opacity: 0.4;
  }

  .bar.locked {
    cursor: not-allowed;
    background-image: repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--hue) 12%, transparent) 6px 8px);
  }

  .corner {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 4px;
  }

  .search {
    flex: 1;
    min-width: 0;
    height: 20px;
    padding: 0 4px;
    border: 1px solid var(--ui-line);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
  }

  .shy-toggle {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    color: var(--ui-ink-3);
  }

  .shy-toggle.on {
    color: var(--ui-accent);
  }

  .work-area {
    position: absolute;
    top: 0;
    height: 6px;
    background: color-mix(in srgb, var(--ui-accent) 45%, transparent);
    pointer-events: none;
  }

  .marker {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: #f5a524;
    pointer-events: none;
    z-index: 2;
  }

  .marker.clip-marker {
    background: #8b5cf6;
  }

  .marker em {
    position: absolute;
    top: 6px;
    left: 4px;
    padding: 0 3px;
    font-style: normal;
    font-size: 10px;
    color: #111;
    background: inherit;
    white-space: nowrap;
  }

  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--ui-ink);
    pointer-events: none;
    z-index: 4;
  }

  .playhead::before {
    content: '';
    position: absolute;
    top: 0;
    left: -5px;
    width: 11px;
    height: 10px;
    background: var(--ui-ink);
    clip-path: polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%);
  }
</style>
