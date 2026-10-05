<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { deserialize } from '$app/forms';
  import { createSupabaseBrowserClient } from '$lib/supabase/client';
  import { canvasUploadPrefix } from '$lib/canvas/upload-kind';
  import { registerUpload } from '$lib/motion/fonts/ops';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import Play from '@lucide/svelte/icons/play';
  import Pause from '@lucide/svelte/icons/pause';
  import Scissors from '@lucide/svelte/icons/scissors';
  import Copy from '@lucide/svelte/icons/copy';
  import Trash from '@lucide/svelte/icons/trash-2';
  import Undo from '@lucide/svelte/icons/undo-2';
  import Redo from '@lucide/svelte/icons/redo-2';
  import Magnet from '@lucide/svelte/icons/magnet';
  import Plus from '@lucide/svelte/icons/plus';
  import ZoomIn from '@lucide/svelte/icons/zoom-in';
  import ZoomOut from '@lucide/svelte/icons/zoom-out';
  import Film from '@lucide/svelte/icons/film';
  import X from '@lucide/svelte/icons/x';
  import Crosshair from '@lucide/svelte/icons/crosshair';
  import Keyboard from '@lucide/svelte/icons/keyboard';
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
  import BotMessageSquare from '@lucide/svelte/icons/bot-message-square';
  import ShortcutHelp from '$lib/components/motion/ShortcutHelp.svelte';
  import { DEFAULT_LAYOUT, Panel, flip, readLayout, timelineHeight, writeLayout, type EditorLayout, type LayoutStore } from '$lib/motion/editor-layout';
  import Layers from '@lucide/svelte/icons/layers';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { addAdjustment, mergeView, pathNames, precompose, viewOf } from '$lib/motion/precomp';
  import ThemeSwitch from '$lib/components/ThemeSwitch.svelte';
  import ChartSpline from '@lucide/svelte/icons/chart-spline';
  import GraphEditor from '$lib/components/motion/GraphEditor.svelte';
  import { nullFromSelection } from '$lib/motion/parent-ops';
  import MotionPreview from '$lib/components/motion/MotionPreview.svelte';
  import type { StreamData } from '$lib/components/brand-agent/chat-session.svelte';
  import { CHECK_REQUEST, FRAMES_REQUEST, type CheckRequest, type FramesRequest } from '$lib/motion/frames-request';
  import { runCheck, type CheckPorts } from '$lib/motion/custom/run-check';
  import { recordCheck } from '$lib/motion/custom/ops';
  import { unverified } from '$lib/motion/custom/determinism';
  import { CheckState, sourceHash } from '$lib/motion/custom/component';
  import MotionTimeline from '$lib/components/motion/MotionTimeline.svelte';
  import MotionInspector from '$lib/components/motion/MotionInspector.svelte';
  import CameraInspector from '$lib/components/motion/CameraInspector.svelte';
  import LookInspector from '$lib/components/motion/LookInspector.svelte';
  import DevicePresets from '$lib/components/motion/DevicePresets.svelte';
  import ParticlePresets from '$lib/components/motion/ParticlePresets.svelte';
  import TimeRemap from '$lib/components/motion/TimeRemap.svelte';
  import { THREE_D_COMPONENTS } from '$lib/motion/components';
  import MaskOverlay from '$lib/components/motion/MaskOverlay.svelte';
  import PenOverlay from '$lib/components/motion/PenOverlay.svelte';
  import MotionPathOverlay from '$lib/components/motion/MotionPathOverlay.svelte';
  import { Align, addMarker, alignClips, allMarkers, clipsTo, distributeClips, trimClipsAt, loopFrame, nudgeClips, sequenceClips, setWorkArea, staggerClips } from '$lib/motion/organize';
  import ExportDialog from '$lib/components/motion/ExportDialog.svelte';
  import TemplateDialog from '$lib/components/motion/TemplateDialog.svelte';
  import SoundDialog, { type Made, type SoundKind } from '$lib/components/motion/SoundDialog.svelte';
  import ChatPanel from '$lib/components/brand-agent/ChatPanel.svelte';
  import { AssetKind, COMPONENTS, LIBRARY_IDS, TrackKind, type ComponentId } from '$lib/motion/components';
  import { FRAME_RATES, type FrameRate } from '$lib/motion/design';
  import { setFrameRate } from '$lib/motion/frame-rate';
  import { setMotionBlur } from '$lib/motion/motion-blur-ops';
  import { Background, FORMATS, MOTION_FORMATS, MAX_SECONDS, findClip, formatOf, type MotionDoc, type MotionFormat } from '$lib/motion/doc';
  import {
    ClipEdge,
    Direction,
    addClip,
    addTrack,
    adjacentKeyframe,
    copyKeyframes,
    deleteKeyframes,
    duplicateClip,
    keyframeFrames,
    pasteKeyframes,
    removeClips,
    setCanvas,
    splitClip,
    type KeyBoard,
    type KeyRef,
    type OpResult
  } from '$lib/motion/timeline';
  import { amend, canRedo, canUndo, previousSource, record, redo, startHistory, undo, type History } from '$lib/motion/history';
  import { Reveal, Snap, clampZoom, timecode } from '$lib/motion/timeline-view';
  import { InspectorTab, parseDecimal, secondsLabel } from '$lib/motion/inspector';
  import { Command, commandFor, isTyping } from '$lib/motion/shortcuts';
  import { composeHtml } from '$lib/motion/hyperframes/compose';
  import { feegaTrailer } from '$lib/motion/trailer';
  import type { AudioAnalysis } from '$lib/motion/audio-analysis';
  import { Hit, cutToBeat, hitFrames, markHits } from '$lib/motion/beats';
  import { audioPlan } from '$lib/motion/audio-plan';
  import { previewAudio } from '$lib/motion/preview-audio';
  import { AD_TEMPLATES, AD_TEMPLATE_IDS, templateAssets, type AdTemplate } from '$lib/motion/ad-templates';
  import { composeEditorPath } from '$lib/motion/composition-draft';
  import type { PageData } from './$types';

  const SAVE_DEBOUNCE_MS = 700;
  const CHECK_WIDTH = 480;
  const CHECK_DEBOUNCE_MS = 900;
  const COALESCE_MS = 800;
  const HEAD_POLL_TRIES = 6;
  const HEAD_POLL_MS = 500;
  const ZOOM_STEP = 1.25;
  const STEP_MORE = 10;

  const SaveState = { Saved: 'Saved', Saving: 'Saving…', Pending: 'Unsaved', Conflict: 'Reloaded the latest version', Failed: 'Not saved' } as const;
  type SaveState = (typeof SaveState)[keyof typeof SaveState];

  const Sheet = { None: 'none', Properties: 'properties', Agent: 'agent' } as const;
  type Sheet = (typeof Sheet)[keyof typeof Sheet];

  let { data }: { data: PageData } = $props();

  let history = $state<History>(startHistory(data.head.doc as MotionDoc));
  let version = $state(data.head.version);
  let selection = $state<string[]>([]);
  let path = $state<{ comp: string; frame: number }[]>([]);
  let cameraOpen = $state(false);
  let keySelection = $state<KeyRef[]>([]);
  let keyBoard: KeyBoard = [];
  let frame = $state(0);
  let playing = $state(false);
  let zoom = $state(1.5);
  let snap = $state(Snap.On);
  let graphOpen = $state(false);
  let saveState = $state<SaveState>(SaveState.Saved);
  let notice = $state('');
  const supabase = createSupabaseBrowserClient();
  const UPLOAD_WEIGHT = 400;
  let adding = $state(false);
  let exporting = $state(false);
  let templating = $state(false);
  let previewDoc = $state<MotionDoc | null>(null);
  let sounding = $state<SoundKind | null>(null);
  let madeAssets = $state<PageData['assets']>([]);
  let analyses = $state<Record<string, AudioAnalysis>>({});
  const waveforms = $derived(Object.fromEntries(Object.entries(analyses).map(([id, a]) => [id, a.amp])));
  const analysing = new Set<string>();
  let sheet = $state<Sheet>(Sheet.None);
  let inspectorTab = $state<InspectorTab>(InspectorTab.Properties);
  let preview = $state<MotionPreview | null>(null);
  let reveal = $state(Reveal.Animated);
  let helpOpen = $state(false);
  let layout = $state<EditorLayout>(DEFAULT_LAYOUT);

  function browserStore(): LayoutStore | null {
    try {
      return localStorage;
    } catch {
      return null;
    }
  }

  onMount(() => {
    layout = readLayout(browserStore());
  });
  let body = $state<HTMLDivElement | null>(null);

  function relayout(next: Partial<EditorLayout>) {
    layout = { ...layout, ...next };
    writeLayout(browserStore(), layout);
  }

  function startResize(e: PointerEvent) {
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    const origin = { y: e.clientY, px: layout.timelinePx };
    const room = body?.getBoundingClientRect().height ?? window.innerHeight;
    const move = (m: PointerEvent) => (layout = { ...layout, timelinePx: timelineHeight(origin.px + origin.y - m.clientY, room) });
    const end = () => {
      handle.removeEventListener('pointermove', move);
      relayout({});
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('lostpointercapture', end, { once: true });
  }

  function revealLanes(next: Reveal) {
    reveal = reveal === next ? Reveal.Animated : next;
  }

  let lastEdit = { summary: '', at: 0 };
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let unsavedSummary = '';

  const compPath = $derived(path.map((p) => p.comp));
  const doc = $derived(viewOf(history.present, compPath));
  const beats = $derived(hitFrames(doc, analyses, Hit.Beats));
  const assets = $derived([...madeAssets, ...data.assets]);
  const assetUrls = $derived(Object.fromEntries(assets.filter((a) => a.url).map((a) => [a.id, a.url as string])));
  const html = $derived(composeHtml({ doc: previewDoc ?? doc, tokens: data.tokens, assets: assetUrls, analyses }));
  const selected = $derived(selection.length === 1 ? (findClip(doc, selection[0])?.clip ?? null) : null);
  const editorUrl = $derived(`/p/${data.projectId}/c/${data.canvas.id}/motion/${data.node.id}`);
  const agentUrl = $derived(`/api/v1/projects/${data.projectId}/motion/${data.node.id}/agent`);

  const soundAssets = $derived(findSoundAssets(doc));

  function findSoundAssets(d: MotionDoc): [string, string][] {
    const ids = new Set(d.tracks.flatMap((t) => t.clips.map((c) => (c.props as { assetId?: string | null }).assetId ?? '')));
    return [...ids].filter((id) => assetUrls[id] && assets.some((a) => a.id === id && (a.kind === AssetKind.Audio || a.kind === AssetKind.Video))).map((id) => [id, assetUrls[id]]);
  }

  const speaker = previewAudio();

  $effect(() => {
    if (!playing) {
      speaker.stop();
      return;
    }
    void speaker.play(audioPlan(doc, assetUrls), untrack(() => frame) / doc.fps);
    return () => speaker.stop();
  });

  function markBeats() {
    const result = markHits(doc, beats, Hit.Beats);
    if (result.ok) {
      edit(result.doc, 'Marked the beats');
    }
  }

  function cutSelectionToBeat() {
    const result = cutToBeat(doc, selection, beats);
    if (!result.ok) {
      notice = result.error;
      return;
    }
    edit(result.doc, 'Cut to the beat');
  }

  async function analyse(ids: string[]) {
    const form = new FormData();
    for (const id of ids) {
      form.append('assetId', id);
    }
    const res = await fetch(`${editorUrl}?/analyze`, { method: 'POST', body: form, headers: { 'x-sveltekit-action': 'true' } });
    const result = deserialize(await res.text());
    if (result.type === 'success') {
      analyses = { ...analyses, ...((result.data as { analyses: Record<string, AudioAnalysis> }).analyses ?? {}) };
    }
  }

  $effect(() => {
    const fresh = soundAssets.map(([id]) => id).filter((id) => !analysing.has(id));
    if (!fresh.length) {
      return;
    }
    for (const id of fresh) {
      analysing.add(id);
    }
    void analyse(fresh).catch(() => {});
  });

  function edit(next: MotionDoc, summary: string) {
    const now = Date.now();
    const root = mergeView(history.present, compPath, next);
    history = summary === lastEdit.summary && now - lastEdit.at < COALESCE_MS ? amend(history, root) : record(history, root);
    lastEdit = { summary, at: now };
    scheduleSave(summary);
  }

  function apply(result: OpResult, summary: string) {
    if (!result.ok) {
      notice = result.error;
      return;
    }
    notice = '';
    edit(result.doc, summary);
  }

  function scheduleSave(summary: string) {
    unsavedSummary = summary;
    saveState = SaveState.Pending;
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => void save(), SAVE_DEBOUNCE_MS);
  }

  async function save() {
    saveState = SaveState.Saving;
    const form = new FormData();
    form.set('doc', JSON.stringify(history.present));
    form.set('version', String(version));
    form.set('summary', unsavedSummary);
    const res = await fetch(`${editorUrl}?/save`, { method: 'POST', body: form, headers: { 'x-sveltekit-action': 'true' } });
    const result = deserialize(await res.text());

    if (result.type === 'success') {
      version = Number(result.data?.version ?? version);
      saveState = SaveState.Saved;
      return;
    }
    if (result.type === 'failure' && result.data?.error === 'conflict') {
      const head = result.data.head as { version: number; doc: MotionDoc };
      history = record(history, head.doc);
      version = head.version;
      saveState = SaveState.Conflict;
      return;
    }
    saveState = SaveState.Failed;
    notice = result.type === 'failure' ? String(result.data?.error ?? '') : '';
  }

  const FONT_EXTENSION = /\.(ttf|otf|woff2?)$/i;

  function familyOf(fileName: string): string {
    const base = fileName.replace(FONT_EXTENSION, '').replace(/[^A-Za-z0-9 \-]+/g, ' ').trim();
    return (base || 'Uploaded font').slice(0, 60);
  }

  async function uploadFont(file: File): Promise<string | null> {
    const path = `${canvasUploadPrefix(data.orgId, data.projectId)}${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
    const up = await supabase.storage.from('canvas-assets').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (up.error) {
      return up.error.message;
    }
    const form = new FormData();
    form.set('path', path);
    const res = await fetch(`${editorUrl}?/uploadFont`, { method: 'POST', body: form, headers: { 'x-sveltekit-action': 'true' } });
    const result = deserialize(await res.text());
    if (result.type !== 'success' || !result.data?.asset) {
      return result.type === 'failure' ? String(result.data?.error ?? 'Upload refused') : 'Upload failed';
    }
    const asset = result.data.asset as PageData['assets'][number];
    madeAssets = [asset, ...madeAssets];
    const registered = registerUpload(doc, { assetId: asset.id, family: familyOf(file.name), weights: [UPLOAD_WEIGHT], italic: false });
    if (!registered.ok) {
      return registered.error;
    }
    edit(registered.doc, `Uploaded the font ${familyOf(file.name)}`);
    return null;
  }

  async function pullAgentEdit() {
    for (let i = 0; i < HEAD_POLL_TRIES; i++) {
      const res = await fetch(agentUrl);
      const body = (await res.json().catch(() => null)) as { head?: { version: number; doc: MotionDoc } } | null;
      if (body?.head && body.head.version > version) {
        history = record(history, body.head.doc);
        version = body.head.version;
        selection = selection.filter((id) => findClip(body.head!.doc, id));
        return;
      }
      await new Promise((r) => setTimeout(r, HEAD_POLL_MS));
    }
  }

  const checkPorts: CheckPorts = {
    compose: (d) => composeHtml({ doc: d, tokens: data.tokens, assets: assetUrls, analyses }),
    capture: (times, source) => (preview ? preview.capture(times, source, CHECK_WIDTH) : Promise.reject(new Error('the preview is still loading')))
  };

  async function answerCheck(request: CheckRequest) {
    const run = await runCheck(request.doc, request.name, checkPorts);
    const verdict = { ok: run.check.state === CheckState.Passed, problems: run.check.problems };
    await fetch(`${agentUrl}/frames`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ callId: request.callId, frames: run.offending, verdict }) });
  }

  let checking = false;
  let checkTimer: ReturnType<typeof setTimeout> | null = null;

  async function checkPending() {
    const next = unverified(history.present).find((u) => u.state === CheckState.Unchecked);
    if (checking || !next || !preview) {
      return;
    }
    checking = true;
    try {
      const run = await runCheck(history.present, next.name, checkPorts);
      const current = history.present.components[next.name];
      if (!current || sourceHash(current) !== run.check.hash) {
        return;
      }
      const recorded = recordCheck(history.present, next.name, run.check);
      if (recorded.ok) {
        history = amend(history, recorded.doc);
        scheduleSave(`Checked ${next.name}`);
      }
    } finally {
      checking = false;
      if (unverified(history.present).some((u) => u.state === CheckState.Unchecked)) {
        checkTimer = setTimeout(() => void checkPending(), CHECK_DEBOUNCE_MS);
      }
    }
  }

  $effect(() => {
    const waiting = unverified(doc).some((u) => u.state === CheckState.Unchecked);
    if (!waiting) {
      return;
    }
    if (checkTimer) {
      clearTimeout(checkTimer);
    }
    checkTimer = setTimeout(() => void checkPending().then(() => (checkTimer = null)), CHECK_DEBOUNCE_MS);
  });

  const AGENT_DATA: Record<string, (data: unknown) => Promise<void>> = {
    [FRAMES_REQUEST]: (d) => showFrames(d as FramesRequest),
    [CHECK_REQUEST]: (d) => answerCheck(d as CheckRequest)
  };

  function onAgentData(part: StreamData) {
    const handle = AGENT_DATA[part.type];
    if (handle && preview) {
      void handle(part.data).catch((e) => console.error('[motion] agent request not answered', part.type, e));
    }
  }

  async function showFrames(request: FramesRequest) {
    if (!preview) {
      return;
    }
    const agentHtml = composeHtml({ doc: request.doc, tokens: data.tokens, assets: assetUrls, analyses });
    const times = request.times.map((t) => Math.min(t, (request.doc.durationInFrames - 1) / request.doc.fps));
    const frames = await preview.capture(times, agentHtml).catch((e) => {
      console.error('[motion] frames not captured', e);
      return null;
    });
    if (!frames) {
      return;
    }
    await fetch(`${agentUrl}/frames`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ callId: request.callId, frames }) });
  }

  const newId = () => crypto.randomUUID().slice(0, 8);

  const ADD: Partial<Record<ComponentId, (id: string) => OpResult>> = {
    Adjustment: (id) => addAdjustment(doc, { from: frame }, { clip: id, track: newId() })
  };

  function add(component: ComponentId) {
    adding = false;
    const id = newId();
    apply(ADD[component]?.(id) ?? addClip(doc, { component, from: frame }, id), `Added ${COMPONENTS[component].label}`);
    selection = [id];
  }

  function precomposeSelection() {
    if (!selection.length) {
      return;
    }
    const id = newId();
    const count = Object.keys(history.present.comps).length + 1;
    apply(precompose(doc, selection, { comp: newId(), clip: id }, `Comp ${count}`), 'Precomposed');
    selection = [id];
  }

  function enterComp(comp: string) {
    path = [...path, { comp, frame }];
    selection = [];
    keySelection = [];
    playing = false;
    frame = 0;
  }

  function leaveTo(depth: number) {
    const back = path[depth];
    if (!back) {
      return;
    }
    path = path.slice(0, depth);
    selection = [];
    keySelection = [];
    playing = false;
    frame = back.frame;
  }

  const firstOf = (kind: AssetKind) => assets.find((a) => a.kind === kind)?.id ?? null;

  function startTrailer() {
    adding = false;
    edit(feegaTrailer({ modelId: firstOf(AssetKind.Model3d), imageId: firstOf(AssetKind.Image) }), 'Started from the feega trailer');
    notice = 'Template applied. ⌘Z to undo.';
  }

  function startTemplate(id: AdTemplate) {
    adding = false;
    edit(AD_TEMPLATES[id].build(templateAssets(assets)), `Started from ${AD_TEMPLATES[id].label}`);
    selection = [];
    frame = 0;
    notice = 'Template applied. Swap pictures, text and colours in Properties. ⌘Z to undo.';
  }

  const SOUND_LABEL: Record<SoundKind, string> = { voice: 'Voice-over', music: 'Music' };

  function placeSound(kind: SoundKind, made: Made) {
    sounding = null;
    madeAssets = [{ id: made.assetId, kind: AssetKind.Audio, label: `${SOUND_LABEL[kind]} · ${made.assetId.slice(0, 6)}`, previewUrl: '', url: made.url, seconds: made.seconds }, ...madeAssets];
    const id = newId();
    const durationInFrames = Math.max(doc.fps, Math.ceil(made.seconds * doc.fps));
    apply(addClip(doc, { component: 'Audio', from: frame, durationInFrames, props: { assetId: made.assetId } }, id), `Added ${SOUND_LABEL[kind].toLowerCase()}`);
    selection = [id];
  }

  function newTrack(kind: TrackKind) {
    apply(addTrack(doc, kind, newId()), 'Added a track');
  }

  function split() {
    for (const id of selection) {
      const result = splitClip(doc, id, frame, newId());
      if (result.ok) {
        edit(result.doc, 'Split');
      }
    }
  }

  function groupUnderNull() {
    const id = newId();
    const result = nullFromSelection(doc, selection, frame, id);
    if (!result.ok) {
      notice = result.error;
      return;
    }
    edit(result.doc, 'Created a null');
    selection = [id];
  }

  function duplicate() {
    const copies: string[] = [];
    for (const id of selection) {
      const copy = newId();
      const result = duplicateClip(doc, id, copy);
      if (result.ok) {
        edit(result.doc, 'Duplicated');
        copies.push(copy);
      }
    }
    selection = copies;
  }

  function remove() {
    if (keySelection.length) {
      apply(deleteKeyframes(doc, keySelection), 'Deleted keyframes');
      keySelection = [];
      return;
    }
    if (!selection.length) {
      return;
    }
    apply(removeClips(doc, selection), 'Deleted');
    selection = [];
  }

  function undoEdit() {
    history = undo(history);
    scheduleSave('Undo');
  }

  function redoEdit() {
    history = redo(history);
    scheduleSave('Redo');
  }

  function step(frames: number) {
    playing = false;
    frame = Math.min(Math.max(0, frame + frames), doc.durationInFrames - 1);
  }

  function jumpKey(direction: Direction) {
    const ids = selection.length ? selection : doc.tracks.flatMap((t) => t.clips.map((c) => c.id));
    const next = adjacentKeyframe(keyframeFrames(doc, ids), frame, direction);
    if (next !== null) {
      playing = false;
      frame = Math.min(next, doc.durationInFrames - 1);
    }
  }

  function copyKeys() {
    if (keySelection.length) {
      keyBoard = copyKeyframes(doc, keySelection);
    }
  }

  function pasteKeys() {
    const target = selected;
    if (!target || !keyBoard.length) {
      return;
    }
    apply(pasteKeyframes(doc, target.id, keyBoard, frame - target.from), 'Pasted keyframes');
  }

  function setFormat(format: MotionFormat) {
    apply(setCanvas(doc, { format }), 'Changed format');
  }

  function setDuration(text: string) {
    const seconds = parseDecimal(text);
    if (seconds === null) {
      return;
    }
    apply(setCanvas(doc, { durationInFrames: Math.round(seconds * doc.fps) }), 'Changed duration');
  }

  function exportFrames(...args: Parameters<MotionPreview['render']>) {
    if (!preview) {
      return Promise.reject(new Error('the preview is still loading'));
    }
    return preview.render(...args);
  }

  const NUDGE_MORE = 10;

  function toPlayhead(edge: ClipEdge) {
    if (selection.length) {
      apply(clipsTo(doc, selection, edge, edge === ClipEdge.End ? frame + 1 : frame), 'Moved to the playhead');
    }
  }

  function trimHere(edge: ClipEdge) {
    if (selection.length) {
      apply(trimClipsAt(doc, selection, edge, edge === ClipEdge.End ? frame + 1 : frame), 'Trimmed');
    }
  }

  function seekTo(target: number) {
    playing = false;
    frame = target;
  }
  const STAGGER_FRAMES = 3;

  function nudge(frames: number) {
    if (selection.length) {
      apply(nudgeClips(doc, selection, frames), 'Nudged');
    }
  }

  function markHere() {
    const taken = new Set(allMarkers(doc).map((m) => m.label));
    let n = 1;
    while (taken.has(`M${n}`)) {
      n++;
    }
    apply(addMarker(doc, { frame, label: `M${n}` }), 'Added a marker');
  }

  function workEdge(edge: 'in' | 'out') {
    const area = doc.workArea ?? { from: 0, to: doc.durationInFrames };
    apply(setWorkArea(doc, edge === 'in' ? { from: frame, to: area.to } : { from: area.from, to: frame + 1 }), 'Set the work area');
  }

  const ARRANGE: Record<string, { label: string; run: () => OpResult }> = {
    sequence: { label: 'Sequence layers', run: () => sequenceClips(doc, selection, 0) },
    stagger: { label: 'Stagger by 3 frames', run: () => staggerClips(doc, selection, STAGGER_FRAMES) },
    alignStart: { label: 'Align starts', run: () => alignClips(doc, selection, Align.Start) },
    alignEnd: { label: 'Align ends', run: () => alignClips(doc, selection, Align.End) },
    distribute: { label: 'Distribute in time', run: () => distributeClips(doc, selection) }
  };

  function arrange(id: string) {
    const op = ARRANGE[id];
    if (op && selection.length > 1) {
      apply(op.run(), op.label);
    }
  }

  $effect(() => {
    if (!playing || !doc.workArea) {
      return;
    }
    const next = loopFrame(doc, frame);
    if (next !== frame) {
      playing = false;
      frame = next;
      queueMicrotask(() => (playing = true));
    }
  });

  const COMMANDS: Record<Command, () => void> = {
    [Command.TogglePlay]: () => (playing = !playing),
    [Command.Delete]: remove,
    [Command.Split]: split,
    [Command.Duplicate]: duplicate,
    [Command.Undo]: undoEdit,
    [Command.Redo]: redoEdit,
    [Command.Play]: () => (playing = true),
    [Command.Pause]: () => (playing = false),
    [Command.Rewind]: () => step(-doc.fps),
    [Command.GoStart]: () => seekTo(0),
    [Command.GoEnd]: () => seekTo(doc.durationInFrames - 1),
    [Command.StepBack]: () => step(-1),
    [Command.StepForward]: () => step(1),
    [Command.StepBackMore]: () => step(-STEP_MORE),
    [Command.StepForwardMore]: () => step(STEP_MORE),
    [Command.ZoomIn]: () => (zoom = clampZoom(zoom * ZOOM_STEP)),
    [Command.ZoomOut]: () => (zoom = clampZoom(zoom / ZOOM_STEP)),
    [Command.SelectAll]: () => (selection = doc.tracks.flatMap((t) => t.clips.map((c) => c.id))),
    [Command.Deselect]: () => {
      helpOpen = false;
      selection = [];
      keySelection = [];
    },
    [Command.PrevKeyframe]: () => jumpKey(Direction.Back),
    [Command.NextKeyframe]: () => jumpKey(Direction.Forward),
    [Command.Copy]: copyKeys,
    [Command.Paste]: pasteKeys,
    [Command.AddMarker]: markHere,
    [Command.WorkIn]: () => workEdge('in'),
    [Command.WorkOut]: () => workEdge('out'),
    [Command.NudgeBack]: () => nudge(-1),
    [Command.NudgeForward]: () => nudge(1),
    [Command.NudgeBackMore]: () => nudge(-NUDGE_MORE),
    [Command.NudgeForwardMore]: () => nudge(NUDGE_MORE),
    [Command.StartHere]: () => toPlayhead(ClipEdge.Start),
    [Command.EndHere]: () => toPlayhead(ClipEdge.End),
    [Command.TrimIn]: () => trimHere(ClipEdge.Start),
    [Command.TrimOut]: () => trimHere(ClipEdge.End),
    [Command.RevealPosition]: () => revealLanes(Reveal.Position),
    [Command.RevealScale]: () => revealLanes(Reveal.Scale),
    [Command.RevealRotation]: () => revealLanes(Reveal.Rotation),
    [Command.RevealOpacity]: () => revealLanes(Reveal.Opacity),
    [Command.RevealAnimated]: () => (reveal = Reveal.Animated),
    [Command.ToggleChat]: () => relayout({ chat: flip(layout.chat) }),
    [Command.ToggleInspector]: () => relayout({ inspector: flip(layout.inspector) }),
    [Command.Help]: () => (helpOpen = !helpOpen),
    [Command.Precompose]: precomposeSelection
  };

  function onKey(e: KeyboardEvent) {
    if (exporting || sounding || isTyping(e.target as HTMLElement | null)) {
      return;
    }
    const command = commandFor({ key: e.key, code: e.code, mod: e.metaKey || e.ctrlKey, shift: e.shiftKey, alt: e.altKey });
    if (!command) {
      return;
    }
    e.preventDefault();
    COMMANDS[command]();
  }
</script>

<svelte:head><title>{data.node.name ?? 'Motion'} · Motion editor</title></svelte:head>
<svelte:window onkeydown={onKey} />

<div class="editor" data-testid="motion-editor">
  <header class="bar">
    <a class="back" href={`/p/${data.projectId}/c/${data.canvas.id}`}><ArrowLeft size={14} /> {data.canvas.name}</a>
    <span class="title">{data.node.name ?? 'Motion'}</span>
    <label class="field">
      Format
      <select value={formatOf(doc)} onchange={(e) => setFormat(e.currentTarget.value as MotionFormat)}>
        {#each MOTION_FORMATS as format (format)}<option value={format}>{FORMATS[format].label}</option>{/each}
      </select>
    </label>
    <label class="field">
      Length (s)
      <input type="text" inputmode="decimal" title={`1–${MAX_SECONDS} s`} value={secondsLabel(doc.durationInFrames, doc.fps)} onchange={(e) => setDuration(e.currentTarget.value)} />
    </label>
    <label class="field">
      Frame rate
      <select value={doc.fps} onchange={(e) => apply(setFrameRate(doc, Number(e.currentTarget.value) as FrameRate), 'Changed frame rate')} data-testid="frame-rate">
        {#each FRAME_RATES as rate (rate)}<option value={rate}>{rate} fps</option>{/each}
      </select>
    </label>
    <label class="field">
      Background
      <select value={doc.background} onchange={(e) => apply(setCanvas(doc, { background: e.currentTarget.value as Background }), 'Changed background')} data-testid="background">
        <option value={Background.Brand}>Brand</option>
        <option value={Background.Transparent}>Transparent</option>
      </select>
    </label>
    <label class="field" title="Real motion blur on server renders; the browser export takes 2 samples, the preview none">
      <input type="checkbox" checked={doc.motionBlur.enabled} onchange={(e) => apply(setMotionBlur(doc, { enabled: e.currentTarget.checked }), 'Changed motion blur')} data-testid="motion-blur" />
      Motion blur
    </label>
    {#if doc.motionBlur.enabled}
      <label class="field">
        Shutter °
        <input type="number" min="1" max="360" value={doc.motionBlur.shutterAngle} onchange={(e) => apply(setMotionBlur(doc, { shutterAngle: Number(e.currentTarget.value) }), 'Changed shutter angle')} data-testid="shutter-angle" />
      </label>
      <label class="field">
        Phase °
        <input type="number" min="-360" max="360" value={doc.motionBlur.shutterPhase} onchange={(e) => apply(setMotionBlur(doc, { shutterPhase: Number(e.currentTarget.value) }), 'Changed shutter phase')} data-testid="shutter-phase" />
      </label>
      <label class="field">
        Samples
        <input type="number" min="2" max="32" value={doc.motionBlur.samples} onchange={(e) => apply(setMotionBlur(doc, { samples: Number(e.currentTarget.value) }), 'Changed blur samples')} data-testid="blur-samples" />
      </label>
    {/if}
    <span class="save" data-testid="save-state">{saveState} · v{version}</span>
    <ThemeSwitch />
    <button type="button" class="panel-toggle" title="Properties (⌥⌘B)" aria-label="Properties panel" aria-pressed={layout.inspector === Panel.Open} data-testid="toggle-inspector" onclick={COMMANDS[Command.ToggleInspector]}><SlidersHorizontal size={14} /></button>
    <button type="button" class="panel-toggle" title="Agent (⌘B)" aria-label="Agent panel" aria-pressed={layout.chat === Panel.Open} data-testid="toggle-chat" onclick={COMMANDS[Command.ToggleChat]}><BotMessageSquare size={14} /></button>
    <button type="button" onclick={() => (leaveTo(0), (templating = true))} data-testid="template-open">Template</button>
    <button type="button" class="render" onclick={() => (leaveTo(0), (exporting = true))} data-testid="export-open"><Film size={14} /> Export</button>
  </header>

  {#if sounding}
    <SoundDialog kind={sounding} {editorUrl} seconds={doc.durationInFrames / doc.fps} onclose={() => (sounding = null)} onmade={(made) => placeSound(sounding ?? 'voice', made)} />
  {/if}

  {#if helpOpen}
    <ShortcutHelp onclose={() => (helpOpen = false)} />
  {/if}

  {#if exporting}
    <ExportDialog
      {doc}
      assetUrls={assetUrls}
      scope={{ orgId: data.orgId, projectId: data.projectId, nodeId: data.node.id }}
      {editorUrl}
      fileName={data.node.name ?? 'motion'}
      render={exportFrames}
      server={{ ...data.serverRender, version, saved: saveState === SaveState.Saved, assetHref: (id: string) => `/p/${data.projectId}/c/${data.canvas.id}/assets/${id}` }}
      onclose={() => (exporting = false)}
    />
  {/if}

  {#if templating}
    <TemplateDialog
      {doc}
      clip={selected}
      {editorUrl}
      {version}
      saved={saveState === SaveState.Saved}
      batch={data.batch}
      assetHref={(id: string) => `/p/${data.projectId}/c/${data.canvas.id}/assets/${id}`}
      onchange={apply}
      onpreview={(next) => (previewDoc = next)}
      onclose={() => (templating = false)}
    />
  {/if}

  <div class="body" bind:this={body} class:coding={inspectorTab === InspectorTab.Code && selected?.component === 'Custom'} class:no-props={layout.inspector === Panel.Closed} class:no-chat={layout.chat === Panel.Closed}>
    <section class="left">
      <div class="preview">
        <MotionPreview bind:this={preview} {html} width={doc.width} height={doc.height} fps={doc.fps} bind:frame bind:playing>
          {#if selected?.mask && !playing && frame >= selected.from && frame < selected.from + selected.durationInFrames}<MaskOverlay {doc} clip={selected} {frame} onchange={edit} />{/if}
          {#if selected?.component === 'Shape' && selected.props.shape === 'path' && !playing && frame >= selected.from && frame < selected.from + selected.durationInFrames}<PenOverlay {doc} clip={selected} onchange={edit} />{/if}
          {#if selected?.path && !playing}<MotionPathOverlay {doc} clip={selected} {frame} onchange={edit} />{/if}
        </MotionPreview>
      </div>

      <div class="resize" role="separator" aria-orientation="horizontal" aria-label="Resize the timeline" aria-valuenow={layout.timelinePx} data-testid="timeline-resize" onpointerdown={startResize}></div>

      <div class="transport">
        <button type="button" aria-label={playing ? 'Pause' : 'Play'} onclick={() => (playing = !playing)}>
          {#if playing}<Pause size={14} />{:else}<Play size={14} />{/if}
        </button>
        <span class="tc" data-testid="timecode">{timecode(frame, doc.fps)} / {timecode(doc.durationInFrames, doc.fps)}</span>
        <span class="sep"></span>
        {#if beats.length}
          <button type="button" data-testid="mark-beats" onclick={markBeats}>Mark beats</button>
        {/if}
        {#if beats.length && selection.length}
          <button type="button" data-testid="cut-to-beat" onclick={cutSelectionToBeat}>Cut to beat</button>
        {/if}
        <div class="add">
          <button type="button" onclick={() => (adding = !adding)}><Plus size={14} /> Add</button>
          {#if adding}
            <div class="menu" role="menu">
              <div class="col">
                <span class="menu-head">Elements</span>
                {#each LIBRARY_IDS as id (id)}
                  <button type="button" role="menuitem" onclick={() => add(id)}>{COMPONENTS[id].label}</button>
                {/each}
              </div>
              <div class="col">
                <span class="menu-head">Ad templates</span>
                {#each AD_TEMPLATE_IDS as id (id)}
                  <button type="button" role="menuitem" onclick={() => startTemplate(id)}>{AD_TEMPLATES[id].label}</button>
                {/each}
                <button type="button" role="menuitem" onclick={startTrailer}>feega trailer template</button>
                <span class="menu-head">Audio</span>
                <button type="button" role="menuitem" onclick={() => ((adding = false), (sounding = 'voice'))}>Generate voice-over…</button>
                <button type="button" role="menuitem" onclick={() => ((adding = false), (sounding = 'music'))}>Generate music…</button>
                <span class="menu-head">Tracks</span>
                <button type="button" role="menuitem" onclick={() => newTrack(TrackKind.Visual)}>Video track</button>
                <button type="button" role="menuitem" onclick={() => newTrack(TrackKind.Audio)}>Audio track</button>
              </div>
            </div>
          {/if}
        </div>
        <button type="button" title="Split at playhead (⇧⌘D)" disabled={!selection.length} onclick={split}><Scissors size={14} /></button>
        <button type="button" title="Duplicate (⌘D)" disabled={!selection.length} onclick={duplicate}><Copy size={14} /></button>
        <button type="button" title="Create null from selection" data-testid="null-from-selection" disabled={!selection.length} onclick={groupUnderNull}><Crosshair size={14} /></button>
        <button type="button" title="Precompose (⇧⌘C)" data-testid="precompose" disabled={!selection.length} onclick={precomposeSelection}><Layers size={14} /></button>
        <button type="button" title="Delete (Del)" disabled={!selection.length} onclick={remove}><Trash size={14} /></button>
        <button type="button" title="Undo (⌘Z)" disabled={!canUndo(history)} onclick={undoEdit}><Undo size={14} /></button>
        <button type="button" title="Redo (⇧⌘Z)" disabled={!canRedo(history)} onclick={redoEdit}><Redo size={14} /></button>
        <button type="button" title="Snap" class:on={snap === Snap.On} onclick={() => (snap = snap === Snap.On ? Snap.Off : Snap.On)}><Magnet size={14} /></button>
        <button type="button" title="Graph editor" aria-pressed={graphOpen} data-testid="graph-toggle" class:on={graphOpen} onclick={() => (graphOpen = !graphOpen)}><ChartSpline size={14} /></button>
        <select class="arrange" aria-label="Arrange" data-testid="arrange" disabled={selection.length < 2} value="" onchange={(e) => (arrange(e.currentTarget.value), (e.currentTarget.value = ''))}>
          <option value="" disabled>Arrange</option>
          {#each Object.entries(ARRANGE) as [id, op] (id)}<option value={id}>{op.label}</option>{/each}
        </select>
        <button type="button" title="Add marker (M)" data-testid="add-marker" onclick={markHere}>M</button>
        <button type="button" title={doc.workArea ? 'Clear work area' : 'Work area: set in/out with I and O'} class:on={!!doc.workArea} onclick={() => apply(setWorkArea(doc, null), 'Cleared the work area')} disabled={!doc.workArea}>[ ]</button>
        <span class="sep"></span>
        <button type="button" title="Zoom out (−)" onclick={COMMANDS[Command.ZoomOut]}><ZoomOut size={14} /></button>
        <button type="button" title="Zoom in (+)" onclick={COMMANDS[Command.ZoomIn]}><ZoomIn size={14} /></button>
        <button type="button" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" data-testid="shortcut-help-open" onclick={COMMANDS[Command.Help]}><Keyboard size={14} /></button>
        {#if notice}<span class="notice" role="status">{notice}</span>{/if}
      </div>

      {#if path.length}
        <nav class="crumbs" aria-label="Compositions" data-testid="comp-breadcrumb">
          <button type="button" onclick={() => leaveTo(0)}>{data.node.name ?? 'Main'}</button>
          {#each pathNames(history.present, compPath) as name, i (i)}
            <ChevronRight size={12} aria-hidden="true" />
            {#if i === path.length - 1}<span aria-current="page">{name}</span>{:else}<button type="button" onclick={() => leaveTo(i + 1)}>{name}</button>{/if}
          {/each}
        </nav>
      {/if}

      <div class="tl" style={`--tl-h: ${layout.timelinePx}px;`}>
        {#if graphOpen}
          <GraphEditor {doc} {frame} {selection} bind:keySelection camera={cameraOpen} onchange={edit} />
        {:else}
          <MotionTimeline {doc} bind:frame bind:selection bind:keySelection bind:camera={cameraOpen} {zoom} {snap} {waveforms} {beats} {assetUrls} {reveal} onchange={edit} onopen={enterComp} />
        {/if}
      </div>
    </section>

    <aside class="props" class:open={sheet === Sheet.Properties} aria-label="Properties">
      <div class="sheet-head"><span>Properties</span><button type="button" aria-label="Close" onclick={() => (sheet = Sheet.None)}><X size={16} /></button></div>
      {#if cameraOpen && !selection.length}
        <CameraInspector {doc} {frame} onchange={edit} />
        <LookInspector {doc} onchange={edit} />
      {:else if selected}
        <MotionInspector {doc} {analyses} clip={selected} tokens={data.tokens} {assets} {frame} previousSource={(name) => previousSource(history, name)} composeHref={composeEditorPath({ projectId: data.projectId, nodeId: data.node.id })} bind:tab={inspectorTab} onchange={edit} onuploadfont={uploadFont} onopen={enterComp} />
        {#if selected.component === 'Device3D'}<DevicePresets {doc} clip={selected} onchange={edit} />{/if}
        {#if selected.component === 'Video'}<TimeRemap {doc} clip={selected} {frame} onchange={edit} />{/if}
        {#if selected.component === 'Particles'}<ParticlePresets {doc} clip={selected} onchange={edit} />{/if}
        {#if THREE_D_COMPONENTS.includes(selected.component)}<LookInspector {doc} onchange={edit} />{/if}
      {:else}
        <p class="hint">{selection.length > 1 ? `${selection.length} clips selected.` : 'Select a clip in the timeline to edit its properties.'}</p>
      {/if}
    </aside>

    <aside class="chat" class:open={sheet === Sheet.Agent} aria-label="Agent">
      <div class="sheet-head"><span>Agent</span><button type="button" aria-label="Close" onclick={() => (sheet = Sheet.None)}><X size={16} /></button></div>
      <ChatPanel projectId={data.projectId} motionNodeId={data.node.id} context={() => ({ selection })} onturnend={() => void pullAgentEdit()} ondata={onAgentData} />
    </aside>
  </div>

  <nav class="tabs" aria-label="Panels">
    <button type="button" class:on={sheet === Sheet.Properties} onclick={() => (sheet = sheet === Sheet.Properties ? Sheet.None : Sheet.Properties)}>Properties</button>
    <button type="button" class:on={sheet === Sheet.Agent} onclick={() => (sheet = sheet === Sheet.Agent ? Sheet.None : Sheet.Agent)}>Agent</button>
  </nav>
</div>

<style>
  .editor {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--ui-bg);
    color: var(--ui-ink);
    font-family: 'DM Sans', system-ui, sans-serif;
    accent-color: var(--ui-accent);
    z-index: 10;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 14px;
    height: var(--ui-bar-h);
    padding: 0 var(--ui-space-3);
    border-bottom: 1px solid var(--ui-line);
    background: var(--ui-bg);
    font-size: var(--ui-text-md);
    flex-shrink: 0;
  }

  .back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--ui-ink-2);
  }

  .title {
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .field {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--ui-ink-2);
  }

  .field select,
  .field input {
    width: 72px;
    height: 28px;
    padding: 0 6px;
    border: 1px solid var(--ui-line);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
  }

  .save {
    margin-left: auto;
    font-family: var(--ui-mono);
    font-size: 11px;
    color: var(--ui-ink-2);
  }

  .render {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 12px;
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
    font-size: var(--ui-text-sm);
    font-weight: 600;
  }

  .render:disabled {
    opacity: 0.5;
  }

  .body {
    --props-w: 280px;
    --chat-w: 380px;
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--props-w) var(--chat-w);
  }

  .body.coding {
    --props-w: 560px;
    --chat-w: 340px;
  }

  .body.no-props {
    --props-w: 0px;
  }

  .body.no-chat {
    --chat-w: 0px;
  }

  .body.no-props .props,
  .body.no-chat .chat {
    display: none;
  }

  .panel-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    color: var(--ui-ink-2);
  }

  .panel-toggle:hover {
    background: var(--ui-hover);
  }

  .panel-toggle[aria-pressed='true'] {
    background: var(--ui-accent-wash);
    color: var(--ui-accent);
  }

  .resize {
    height: 5px;
    margin-bottom: -5px;
    position: relative;
    z-index: 2;
    flex-shrink: 0;
    cursor: row-resize;
    touch-action: none;
  }

  .resize:hover {
    background: var(--ui-accent);
  }

  .left {
    grid-column: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .preview {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: var(--ui-surface);
    container-type: size;
  }

  .crumbs {
    display: flex;
    align-items: center;
    gap: var(--ui-space-1);
    padding: 0 var(--ui-space-2);
    height: 28px;
    border-top: 1px solid var(--ui-line);
    background: var(--ui-surface);
    color: var(--ui-ink-2);
    font-size: var(--ui-text-sm);
    flex-shrink: 0;
  }

  .crumbs button {
    border: 0;
    border-radius: 0;
    background: none;
    color: var(--ui-ink-2);
    padding: 2px 4px;
    font: inherit;
    cursor: pointer;
  }

  .crumbs button:hover {
    background: var(--ui-hover);
    color: var(--ui-ink);
  }

  .crumbs [aria-current='page'] {
    color: var(--ui-ink);
    font-weight: 600;
    padding: 2px 4px;
  }

  .transport {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 40px;
    padding: 0 var(--ui-space-2);
    border-top: 1px solid var(--ui-line);
    background: var(--ui-bg);
    font-size: var(--ui-text-sm);
    flex-shrink: 0;
  }

  .transport > button,
  .add > button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 7px;
    color: var(--ui-ink);
  }

  .transport button:hover:not(:disabled) {
    background: var(--ui-hover);
  }

  .transport button:disabled {
    opacity: 0.35;
  }

  .transport button.on {
    background: var(--ui-accent-wash);
    color: var(--ui-accent);
  }

  .tc {
    font-family: var(--ui-mono);
    font-size: 11px;
    padding: 0 6px;
  }

  .sep {
    width: 1px;
    height: 18px;
    background: var(--ui-line);
    margin: 0 4px;
  }

  .add {
    position: relative;
  }

  .menu {
    position: absolute;
    bottom: 30px;
    left: 0;
    z-index: 20;
    display: grid;
    grid-template-columns: 160px 220px;
    gap: 4px;
    max-height: calc(100vh - 120px);
    overflow: auto;
    padding: 4px;
    background: var(--ui-bg);
    border: 1px solid var(--ui-line);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
  }

  .menu .col {
    display: flex;
    flex-direction: column;
  }

  .menu button {
    text-align: left;
    padding: 5px 8px;
  }

  .menu button:hover {
    background: var(--ui-hover);
  }

  .menu-head {
    padding: 4px 8px 2px;
    font-family: var(--ui-mono);
    font-size: 10px;
    text-transform: uppercase;
    color: var(--ui-ink-2);
  }


  .notice {
    margin-left: 8px;
    color: var(--ui-ink-2);
  }

  .tl {
    height: var(--tl-h);
    flex-shrink: 0;
  }

  .props {
    grid-column: 2;
    border-left: 1px solid var(--ui-line);
    min-height: 0;
    overflow: hidden;
  }

  .hint {
    padding: 16px 12px;
    color: var(--ui-ink-2);
    font-size: 12px;
  }

  .chat {
    grid-column: 3;
    border-left: 1px solid var(--ui-line);
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .sheet-head,
  .tabs {
    display: none;
  }

  @media (max-width: 760px) {
    .bar {
      gap: 8px;
      height: auto;
      min-height: 44px;
      flex-wrap: wrap;
      padding: 6px 12px;
    }

    .bar .title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .bar .save,
    .bar .render {
      display: none;
    }

    .body {
      display: flex;
      flex-direction: column;
    }

    .left {
      flex: 1;
    }

    .preview {
      flex: 0 0 auto;
      height: 34vh;
      padding: 8px;
    }

    .transport {
      overflow-x: auto;
      flex-wrap: nowrap;
    }

    .transport > * {
      flex-shrink: 0;
    }

    .menu {
      position: fixed;
      left: 8px;
      right: 8px;
      grid-template-columns: 1fr 1fr;
      bottom: 104px;
      max-height: 50vh;
      overflow: auto;
    }

    .tl {
      flex: 1;
      height: auto;
      min-height: 160px;
    }

    .props,
    .chat {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 48px;
      height: 70vh;
      z-index: 30;
      display: none;
      flex-direction: column;
      background: var(--ui-bg);
      border-left: 0;
      border-top: 1px solid var(--ui-line);
      box-shadow: 0 -12px 32px rgb(0 0 0 / 0.16);
    }

    .props.open,
    .chat.open {
      display: flex;
    }

    .props.open {
      overflow: auto;
    }

    .sheet-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid var(--ui-line);
      font-weight: 600;
      flex-shrink: 0;
    }

    .chat :global(> :last-child) {
      flex: 1;
      min-height: 0;
    }

    .tabs {
      display: flex;
      flex-shrink: 0;
      height: 48px;
      border-top: 1px solid var(--ui-line);
    }

    .tabs button {
      flex: 1;
      font-size: 13px;
      font-weight: 500;
      color: var(--ui-ink-2);
    }

    .tabs button.on {
      color: var(--ui-ink);
      box-shadow: inset 0 2px 0 var(--ui-ink);
    }
  }
</style>
