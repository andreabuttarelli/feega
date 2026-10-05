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
  import SkipBack from '@lucide/svelte/icons/skip-back';
  import SkipForward from '@lucide/svelte/icons/skip-forward';
  import StepBack from '@lucide/svelte/icons/step-back';
  import StepForward from '@lucide/svelte/icons/step-forward';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Bookmark from '@lucide/svelte/icons/bookmark';
  import Brackets from '@lucide/svelte/icons/brackets';
  import PanelRight from '@lucide/svelte/icons/panel-right';
  import CompositionSettings from '$lib/components/motion/CompositionSettings.svelte';
  import { SAVE_TONE, SaveState, TimeDisplay, clockLabel, compositionLabel, compositionShort, nextDisplay } from '$lib/motion/editor-bar';
  import X from '@lucide/svelte/icons/x';
  import Crosshair from '@lucide/svelte/icons/crosshair';
  import Keyboard from '@lucide/svelte/icons/keyboard';
  import BotMessageSquare from '@lucide/svelte/icons/bot-message-square';
  import ShortcutHelp from '$lib/components/motion/ShortcutHelp.svelte';
  import { CHAT_PLACE, ChatPlace, DEFAULT_LAYOUT, Panel, flip, readLayout, timelineHeight, viewportOf, writeLayout, type EditorLayout, type LayoutStore } from '$lib/motion/editor-layout';
  import { provideSelection } from '$lib/motion/selection-context';
  import Layers from '@lucide/svelte/icons/layers';
  import { addAdjustment, mergeView, pathNames, precompose, viewOf } from '$lib/motion/precomp';
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
  import SelectionOverlay from '$lib/components/motion/SelectionOverlay.svelte';
  import MotionPathOverlay from '$lib/components/motion/MotionPathOverlay.svelte';
  import { Align, addMarker, alignClips, allMarkers, clipsTo, distributeClips, trimClipsAt, loopFrame, nudgeClips, sequenceClips, setWorkArea, staggerClips } from '$lib/motion/organize';
  import ExportDialog from '$lib/components/motion/ExportDialog.svelte';
  import TemplateDialog from '$lib/components/motion/TemplateDialog.svelte';
  import SoundDialog, { type Made, type SoundKind } from '$lib/components/motion/SoundDialog.svelte';
  import ChatPanel from '$lib/components/brand-agent/ChatPanel.svelte';
  import { AssetKind, COMPONENTS, LIBRARY_IDS, TrackKind, type ComponentId } from '$lib/motion/components';
  import { findClip, type MotionDoc } from '$lib/motion/doc';
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
    splitClip,
    type KeyBoard,
    type KeyRef,
    type OpResult
  } from '$lib/motion/timeline';
  import { amend, canRedo, canUndo, previousSource, record, redo, startHistory, undo, type History } from '$lib/motion/history';
  import { Reveal, Snap, ZOOM_MAX, ZOOM_MIN, clampZoom } from '$lib/motion/timeline-view';
  import { InspectorTab } from '$lib/motion/inspector';
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
  let display = $state(TimeDisplay.Timecode);
  let width = $state(1440);
  const viewport = $derived(viewportOf(width));
  const chatPlace = $derived(CHAT_PLACE[viewport]);
  let settingsOpen = $state(false);

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

  provideSelection({
    get ids() {
      return selection;
    },
    get clip() {
      return selected;
    },
    select: (ids) => {
      selection = ids;
      cameraOpen = false;
    }
  });
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

  const CHAT_TOGGLE: Record<ChatPlace, () => void> = {
    [ChatPlace.Column]: () => relayout({ chat: flip(layout.chat) }),
    [ChatPlace.Drawer]: () => (sheet = sheet === Sheet.Agent ? Sheet.None : Sheet.Agent),
    [ChatPlace.Sheet]: () => (sheet = sheet === Sheet.Agent ? Sheet.None : Sheet.Agent)
  };
  const chatShown = $derived(chatPlace === ChatPlace.Column ? layout.chat === Panel.Open : sheet === Sheet.Agent);

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
    [Command.ToggleChat]: () => CHAT_TOGGLE[chatPlace](),
    [Command.ToggleInspector]: () => relayout({ inspector: flip(layout.inspector) }),
    [Command.Help]: () => (helpOpen = !helpOpen),
    [Command.Precompose]: precomposeSelection
  };

  function closeSettings(e: PointerEvent) {
    if (settingsOpen && !(e.target as HTMLElement | null)?.closest('.popover-anchor')) {
      settingsOpen = false;
    }
  }

  function onKey(e: KeyboardEvent) {
    if (settingsOpen && e.key === 'Escape') {
      settingsOpen = false;
      return;
    }
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
<svelte:window bind:innerWidth={width} onkeydown={onKey} onpointerdown={closeSettings} />

<div class="editor" data-testid="motion-editor" data-viewport={viewport}>
  <header class="bar">
    <div class="group lead">
      <a class="icon-btn" href={`/p/${data.projectId}/c/${data.canvas.id}`} title={`Back to ${data.canvas.name}`} aria-label={`Back to ${data.canvas.name}`}><ArrowLeft size={16} /></a>
      <nav class="crumbs" aria-label="Compositions" data-testid="comp-breadcrumb">
        <a class="crumb" href={`/p/${data.projectId}/c/${data.canvas.id}`}>{data.canvas.name}</a>
        <span class="slash" aria-hidden="true">/</span>
        {#if path.length}
          <button type="button" class="crumb" onclick={() => leaveTo(0)}>{data.node.name ?? 'Motion'}</button>
        {:else}
          <span class="crumb current" aria-current="page">{data.node.name ?? 'Motion'}</span>
        {/if}
        {#each pathNames(history.present, compPath) as name, i (i)}
          <span class="slash" aria-hidden="true">/</span>
          {#if i === path.length - 1}<span class="crumb current" aria-current="page">{name}</span>{:else}<button type="button" class="crumb" onclick={() => leaveTo(i + 1)}>{name}</button>{/if}
        {/each}
      </nav>
    </div>

    <div class="group transport" role="group" aria-label="Transport">
      <button type="button" class="icon-btn" title="Go to start (Home)" aria-label="Go to start" onclick={COMMANDS[Command.GoStart]}><SkipBack size={16} /></button>
      <button type="button" class="icon-btn step" title="Previous frame (←)" aria-label="Previous frame" onclick={COMMANDS[Command.StepBack]}><StepBack size={16} /></button>
      <button type="button" class="icon-btn play" aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause (Space)' : 'Play (Space)'} onclick={() => (playing = !playing)}>
        {#if playing}<Pause size={16} fill="currentColor" />{:else}<Play size={16} fill="currentColor" />{/if}
      </button>
      <button type="button" class="icon-btn step" title="Next frame (→)" aria-label="Next frame" onclick={COMMANDS[Command.StepForward]}><StepForward size={16} /></button>
      <button type="button" class="icon-btn" title="Go to end (End)" aria-label="Go to end" onclick={COMMANDS[Command.GoEnd]}><SkipForward size={16} /></button>
      <button type="button" class="clock" title={display === TimeDisplay.Timecode ? 'Show frames' : 'Show timecode'} data-testid="clock" onclick={() => (display = nextDisplay(display))}>
        <span data-testid="timecode"><b>{clockLabel(frame, doc.fps, display)}</b> <i>/ {clockLabel(doc.durationInFrames, doc.fps, display)}</i></span>
      </button>
    </div>

    <div class="group trail">
      <div class="popover-anchor">
        <button type="button" class="chip" aria-expanded={settingsOpen} title="Composition settings" data-testid="comp-settings" onclick={() => (settingsOpen = !settingsOpen)}>
          <span class="long">{compositionLabel(doc)}</span><span class="short">{compositionShort(doc)}</span><ChevronDown size={12} />
        </button>
        {#if settingsOpen}
          <div class="popover" role="dialog" aria-label="Composition settings">
            <span class="popover-head">Composition</span>
            <CompositionSettings {doc} onchange={apply} />
          </div>
        {/if}
      </div>
      <span class="save" data-testid="save-state" data-tone={SAVE_TONE[saveState]}><i aria-hidden="true"></i>{saveState} · v{version}</span>
      <span class="divider" aria-hidden="true"></span>
      <button type="button" class="icon-btn toggle" title="Properties (⌥⌘B)" aria-label="Properties panel" aria-pressed={layout.inspector === Panel.Open} data-testid="toggle-inspector" onclick={COMMANDS[Command.ToggleInspector]}><PanelRight size={16} /></button>
      <button type="button" class="icon-btn toggle" title="Agent (⌘B)" aria-label="Agent panel" aria-pressed={chatShown} data-testid="toggle-chat" onclick={COMMANDS[Command.ToggleChat]}><BotMessageSquare size={16} /></button>
      <span class="divider" aria-hidden="true"></span>
      <button type="button" class="secondary" onclick={() => (leaveTo(0), (templating = true))} data-testid="template-open">Template</button>
      <button type="button" class="render" onclick={() => (leaveTo(0), (exporting = true))} data-testid="export-open">Export</button>
    </div>
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

  <div class="body" bind:this={body} style={`--tl-h: ${layout.timelinePx}px;`} class:coding={inspectorTab === InspectorTab.Code && selected?.component === 'Custom'} class:no-props={layout.inspector === Panel.Closed} class:no-chat={layout.chat === Panel.Closed}>
    <section class="stage" aria-label="Preview">
      <MotionPreview bind:this={preview} {html} width={doc.width} height={doc.height} fps={doc.fps} bind:frame bind:playing>
        {#if !playing}<SelectionOverlay {doc} {frame} {html} measure={() => preview?.measure() ?? Promise.resolve({})} onpreview={(next) => (previewDoc = next)} onchange={edit} />{/if}
        {#if selected?.mask && !playing && frame >= selected.from && frame < selected.from + selected.durationInFrames}<MaskOverlay {doc} clip={selected} {frame} onchange={edit} />{/if}
        {#if selected?.component === 'Shape' && selected.props.shape === 'path' && !playing && frame >= selected.from && frame < selected.from + selected.durationInFrames}<PenOverlay {doc} clip={selected} onchange={edit} />{/if}
        {#if selected?.path && !playing}<MotionPathOverlay {doc} clip={selected} {frame} onchange={edit} />{/if}
      </MotionPreview>
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

    <section class="timeline-area" aria-label="Timeline">
      <div class="resize" role="separator" aria-orientation="horizontal" aria-label="Resize the timeline" aria-valuenow={layout.timelinePx} data-testid="timeline-resize" onpointerdown={startResize}></div>

      <div class="toolbar">
        <div class="add">
          <button type="button" class="tool text" onclick={() => (adding = !adding)}><Plus size={14} /> Add</button>
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
        <span class="divider" aria-hidden="true"></span>
        <button type="button" class="tool" title="Split at playhead (⇧⌘D)" aria-label="Split" disabled={!selection.length} onclick={split}><Scissors size={14} /></button>
        <button type="button" class="tool" title="Duplicate (⌘D)" aria-label="Duplicate" disabled={!selection.length} onclick={duplicate}><Copy size={14} /></button>
        <button type="button" class="tool" title="Create null from selection" aria-label="Create null from selection" data-testid="null-from-selection" disabled={!selection.length} onclick={groupUnderNull}><Crosshair size={14} /></button>
        <button type="button" class="tool" title="Precompose (⇧⌘C)" aria-label="Precompose" data-testid="precompose" disabled={!selection.length} onclick={precomposeSelection}><Layers size={14} /></button>
        <button type="button" class="tool" title="Delete (Del)" aria-label="Delete" disabled={!selection.length && !keySelection.length} onclick={remove}><Trash size={14} /></button>
        <span class="divider" aria-hidden="true"></span>
        <button type="button" class="tool" title="Undo (⌘Z)" aria-label="Undo" disabled={!canUndo(history)} onclick={undoEdit}><Undo size={14} /></button>
        <button type="button" class="tool" title="Redo (⇧⌘Z)" aria-label="Redo" disabled={!canRedo(history)} onclick={redoEdit}><Redo size={14} /></button>
        <span class="divider" aria-hidden="true"></span>
        <div class="segmented" role="group" aria-label="Timeline mode">
          <button type="button" aria-pressed={!graphOpen} onclick={() => (graphOpen = false)}>Clips</button>
          <button type="button" aria-pressed={graphOpen} data-testid="graph-toggle" onclick={() => (graphOpen = !graphOpen)}>Graph</button>
        </div>
        <button type="button" class="tool" title="Snap" aria-label="Snap" aria-pressed={snap === Snap.On} onclick={() => (snap = snap === Snap.On ? Snap.Off : Snap.On)}><Magnet size={14} /></button>
        <button type="button" class="tool" title="Add marker (M)" aria-label="Add marker" data-testid="add-marker" onclick={markHere}><Bookmark size={14} /></button>
        <button type="button" class="tool" title={doc.workArea ? 'Clear work area' : 'Work area: set in/out with I and O'} aria-label="Work area" aria-pressed={!!doc.workArea} onclick={() => apply(setWorkArea(doc, null), 'Cleared the work area')} disabled={!doc.workArea}><Brackets size={14} /></button>
        {#if selection.length > 1}
          <select class="arrange" aria-label="Arrange" data-testid="arrange" value="" onchange={(e) => (arrange(e.currentTarget.value), (e.currentTarget.value = ''))}>
            <option value="" disabled>Arrange</option>
            {#each Object.entries(ARRANGE) as [id, op] (id)}<option value={id}>{op.label}</option>{/each}
          </select>
        {/if}
        {#if beats.length}
          <span class="divider" aria-hidden="true"></span>
          <button type="button" class="tool text" data-testid="mark-beats" onclick={markBeats}>Mark beats</button>
          {#if selection.length}<button type="button" class="tool text" data-testid="cut-to-beat" onclick={cutSelectionToBeat}>Cut to beat</button>{/if}
        {/if}
        {#if notice}<span class="notice" role="status">{notice}</span>{/if}
        <span class="spacer"></span>
        <button type="button" class="tool" title="Zoom out (−)" aria-label="Zoom out" onclick={COMMANDS[Command.ZoomOut]}><ZoomOut size={14} /></button>
        <input class="zoom" type="range" aria-label="Timeline zoom" min={Math.log2(ZOOM_MIN)} max={Math.log2(ZOOM_MAX)} step="0.05" value={Math.log2(zoom)} oninput={(e) => (zoom = clampZoom(2 ** Number(e.currentTarget.value)))} data-testid="timeline-zoom" />
        <button type="button" class="tool" title="Zoom in (+)" aria-label="Zoom in" onclick={COMMANDS[Command.ZoomIn]}><ZoomIn size={14} /></button>
        <button type="button" class="tool" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" data-testid="shortcut-help-open" onclick={COMMANDS[Command.Help]}><Keyboard size={14} /></button>
      </div>

      <div class="tl">
        {#if graphOpen}
          <GraphEditor {doc} {frame} {selection} bind:keySelection camera={cameraOpen} onchange={edit} />
        {:else}
          <MotionTimeline {doc} bind:frame bind:selection bind:keySelection bind:camera={cameraOpen} {zoom} {snap} {waveforms} {beats} {assetUrls} {reveal} onchange={edit} onopen={enterComp} />
        {/if}
      </div>
    </section>
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

  .editor :global(:focus-visible) {
    outline: 1px solid var(--ui-accent);
    outline-offset: -1px;
  }

  .bar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: stretch;
    height: var(--ui-bar-h-dense);
    border-bottom: 1px solid var(--ui-line);
    background: var(--ui-bg);
    font-size: var(--ui-text-sm);
    flex-shrink: 0;
  }

  .group {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    padding: 0 var(--ui-space-2);
  }

  .lead {
    gap: var(--ui-space-1);
  }

  .transport {
    justify-content: center;
    border-left: 1px solid var(--ui-line);
    border-right: 1px solid var(--ui-line);
    padding: 0 var(--ui-space-3);
  }

  .trail {
    justify-content: flex-end;
    gap: var(--ui-space-1);
  }

  .icon-btn,
  .tool,
  .clock,
  .crumb,
  .segmented button {
    border: 0;
    border-radius: 0;
    background: none;
    cursor: pointer;
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    color: var(--ui-ink-2);
  }

  .icon-btn:hover {
    background: var(--ui-hover);
    color: var(--ui-ink);
  }

  .icon-btn.play {
    color: var(--ui-ink);
  }

  .icon-btn.toggle[aria-pressed='true'] {
    background: var(--ui-accent-wash);
    color: var(--ui-accent);
  }

  .crumbs {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    font-size: var(--ui-text-md);
  }

  .crumb {
    flex-shrink: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 4px 6px;
    color: var(--ui-ink-2);
    font: inherit;
  }

  a.crumb:hover,
  button.crumb:hover {
    background: var(--ui-hover);
    color: var(--ui-ink);
  }

  .crumb.current {
    color: var(--ui-ink);
    font-weight: 600;
  }

  .slash {
    color: var(--ui-ink-3);
  }

  .clock {
    margin-left: var(--ui-space-2);
    padding: 4px 6px;
    font-family: var(--ui-mono);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .clock:hover {
    background: var(--ui-hover);
  }

  .clock b {
    font-size: var(--ui-text-md);
    font-weight: 400;
    color: var(--ui-ink);
  }

  .clock i {
    font-style: normal;
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-3);
  }

  .popover-anchor {
    position: relative;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 8px;
    border: 1px solid var(--ui-line);
    background: var(--ui-surface);
    color: var(--ui-ink-2);
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .chip:hover,
  .chip[aria-expanded='true'] {
    border-color: var(--ui-line-strong);
    color: var(--ui-ink);
  }

  .popover {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 40;
    width: 300px;
    padding: var(--ui-space-3);
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.14);
  }

  .popover-head {
    display: block;
    margin-bottom: var(--ui-space-2);
    font-size: var(--ui-text-sm);
    font-weight: 600;
  }

  .save {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 var(--ui-space-1);
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-3);
    white-space: nowrap;
  }

  .save i {
    width: 6px;
    height: 6px;
    background: var(--ui-ok);
  }

  .save[data-tone='busy'] i {
    background: var(--ui-warn);
  }

  .save[data-tone='error'] i {
    background: var(--ui-danger);
  }

  .save[data-tone='error'] {
    color: var(--ui-danger);
  }

  .divider {
    align-self: stretch;
    width: 1px;
    margin: 8px var(--ui-space-1);
    background: var(--ui-line);
  }

  .secondary,
  .render {
    height: 28px;
    padding: 0 12px;
    font-size: var(--ui-text-sm);
    font-weight: 600;
    white-space: nowrap;
  }

  .secondary {
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
    color: var(--ui-ink);
  }

  .secondary:hover {
    background: var(--ui-hover);
  }

  .render {
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
  }

  .render:hover {
    background: color-mix(in srgb, var(--ui-accent) 88%, #000);
  }

  .body {
    --props-w: 300px;
    --chat-w: 360px;
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--props-w) var(--chat-w);
    grid-template-rows: minmax(0, 1fr) var(--tl-h);
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

  .stage {
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--ui-space-6);
    background: var(--ui-surface);
    container-type: size;
  }

  .stage :global(> *) {
    outline: 1px solid var(--ui-line-strong);
  }

  .props {
    grid-column: 2;
    grid-row: 1;
    border-left: 1px solid var(--ui-line);
    min-height: 0;
    overflow: hidden;
  }

  .chat {
    grid-column: 3;
    grid-row: 1 / 3;
    border-left: 1px solid var(--ui-line);
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .timeline-area {
    grid-column: 1 / 3;
    grid-row: 2;
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    border-top: 1px solid var(--ui-line);
  }

  .resize {
    position: absolute;
    top: -3px;
    left: 0;
    right: 0;
    height: 5px;
    z-index: 3;
    cursor: row-resize;
    touch-action: none;
  }

  .resize:hover {
    background: var(--ui-accent);
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 32px;
    padding: 0 var(--ui-space-2);
    border-bottom: 1px solid var(--ui-line);
    background: var(--ui-bg);
    font-size: var(--ui-text-sm);
    flex-shrink: 0;
  }

  .tool {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 24px;
    height: 24px;
    color: var(--ui-ink-2);
  }

  .tool.text {
    padding: 0 6px;
    color: var(--ui-ink);
  }

  .tool:hover:not(:disabled) {
    background: var(--ui-hover);
    color: var(--ui-ink);
  }

  .tool:disabled {
    color: var(--ui-ink-3);
    opacity: 0.6;
  }

  .tool[aria-pressed='true'] {
    background: var(--ui-accent-wash);
    color: var(--ui-accent);
  }

  .toolbar .divider {
    margin: 8px 6px;
  }

  .segmented {
    display: inline-flex;
    height: 24px;
    margin-right: 4px;
    border: 1px solid var(--ui-line);
  }

  .segmented button {
    padding: 0 10px;
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-2);
  }

  .segmented button + button {
    border-left: 1px solid var(--ui-line);
  }

  .segmented button:hover {
    color: var(--ui-ink);
  }

  .segmented button[aria-pressed='true'] {
    background: var(--ui-accent-wash);
    color: var(--ui-accent);
  }

  .arrange {
    height: 24px;
    margin-left: 4px;
    padding: 0 4px;
    border: 1px solid var(--ui-line-strong);
    border-radius: 0;
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-xs);
  }

  .spacer {
    flex: 1;
  }

  .zoom {
    width: 120px;
    height: 24px;
    margin: 0 4px;
    appearance: none;
    background: transparent;
    cursor: pointer;
    touch-action: none;
  }

  .zoom::-webkit-slider-runnable-track {
    height: 2px;
    background: var(--ui-line-strong);
  }

  .zoom::-moz-range-track {
    height: 2px;
    background: var(--ui-line-strong);
  }

  .zoom::-webkit-slider-thumb {
    appearance: none;
    width: 10px;
    height: 10px;
    margin-top: -4px;
    border: 1.5px solid var(--ui-ink-2);
    border-radius: 0;
    background: var(--ui-bg);
  }

  .zoom::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border: 1.5px solid var(--ui-ink-2);
    border-radius: 0;
    background: var(--ui-bg);
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
    border: 1px solid var(--ui-line-strong);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.14);
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
    padding: 6px 8px 2px;
    font-size: var(--ui-text-xs);
    font-weight: 600;
    color: var(--ui-ink-3);
  }

  .notice {
    margin-left: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ui-ink-2);
  }

  .tl {
    flex: 1;
    min-height: 0;
  }

  .hint {
    padding: 16px 12px;
    color: var(--ui-ink-2);
    font-size: 12px;
  }

  .sheet-head,
  .tabs {
    display: none;
  }

  @media (max-width: 1280px) {
    .save {
      font-size: 0;
      gap: 0;
    }
  }

  @media (pointer: coarse) {
    .icon-btn,
    .tool {
      min-width: 44px;
      height: 44px;
    }

    .toolbar {
      height: 48px;
    }

    .segmented {
      height: 36px;
    }

    .chip,
    .secondary,
    .render {
      height: 36px;
    }
  }

  .chip .short {
    display: none;
  }

  [data-viewport='tablet'] .chip .long,
  [data-viewport='tablet'] .step,
  [data-viewport='tablet'] .crumb:not(.current),
  [data-viewport='tablet'] .slash {
    display: none;
  }

  [data-viewport='tablet'] .chip .short {
    display: inline;
  }

  [data-viewport='tablet'] .bar {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  [data-viewport='tablet'] .toolbar {
    overflow-x: auto;
  }

  [data-viewport='tablet'] .toolbar > * {
    flex-shrink: 0;
  }

  [data-viewport='tablet'] .body {
    --props-w: 280px;
    --chat-w: 0px;
  }

  [data-viewport='tablet'] .chat {
    display: none;
  }

  [data-viewport='tablet'] .chat.open {
    display: flex;
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(380px, 90vw);
    z-index: 30;
    background: var(--ui-bg);
    box-shadow: -12px 0 32px rgb(0 0 0 / 0.16);
  }

  [data-viewport='tablet'] .body {
    position: relative;
  }

  [data-viewport='tablet'] .chat .sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--ui-line);
    font-weight: 600;
    flex-shrink: 0;
  }

  [data-viewport='tablet'] .chat :global(> :last-child) {
    flex: 1;
    min-height: 0;
  }

  [data-viewport='phone'] {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: auto minmax(0, 1fr) auto auto;
    grid-template-areas: 'lead trail' 'body body' 'transport transport' 'tabs tabs';
  }

  [data-viewport='phone'] .bar {
    display: contents;
  }

  [data-viewport='phone'] .lead {
    grid-area: lead;
    height: 48px;
    border-bottom: 1px solid var(--ui-line);
  }

  [data-viewport='phone'] .trail {
    grid-area: trail;
    height: 48px;
    border-bottom: 1px solid var(--ui-line);
  }

  [data-viewport='phone'] .transport {
    grid-area: transport;
    height: 56px;
    border: 0;
    border-top: 1px solid var(--ui-line);
    background: var(--ui-bg);
  }

  [data-viewport='phone'] .transport .icon-btn {
    width: 44px;
    height: 44px;
  }

  [data-viewport='phone'] .crumb:not(.current),
  [data-viewport='phone'] .slash,
  [data-viewport='phone'] .save,
  [data-viewport='phone'] .chip,
  [data-viewport='phone'] .trail .divider,
  [data-viewport='phone'] .trail .toggle {
    display: none;
  }

  [data-viewport='phone'] .body {
    grid-area: body;
    display: flex;
    flex-direction: column;
  }

  [data-viewport='phone'] .stage {
    flex: 0 0 auto;
    height: 34vh;
    padding: 8px;
  }

  [data-viewport='phone'] .timeline-area {
    flex: 1;
    min-height: 160px;
  }

  [data-viewport='phone'] .resize {
    display: none;
  }

  [data-viewport='phone'] .toolbar {
    overflow-x: auto;
  }

  [data-viewport='phone'] .toolbar > * {
    flex-shrink: 0;
  }

  [data-viewport='phone'] .menu {
    position: fixed;
    left: 8px;
    right: 8px;
    grid-template-columns: 1fr 1fr;
    top: 96px;
    bottom: auto;
    max-height: 50vh;
    overflow: auto;
  }

  [data-viewport='phone'] .props,
  [data-viewport='phone'] .chat {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 104px;
    height: 62vh;
    z-index: 30;
    display: none;
    flex-direction: column;
    background: var(--ui-bg);
    border-left: 0;
    border-top: 1px solid var(--ui-line-strong);
    box-shadow: 0 -12px 32px rgb(0 0 0 / 0.16);
  }

  [data-viewport='phone'] .props.open,
  [data-viewport='phone'] .chat.open {
    display: flex;
  }

  [data-viewport='phone'] .props.open {
    overflow: auto;
  }

  [data-viewport='phone'] .sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 44px;
    padding: 0 4px 0 12px;
    border-bottom: 1px solid var(--ui-line);
    font-weight: 600;
    flex-shrink: 0;
  }

  [data-viewport='phone'] .sheet-head button {
    width: 44px;
    height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  [data-viewport='phone'] .chat :global(> :last-child) {
    flex: 1;
    min-height: 0;
  }

  [data-viewport='phone'] .tabs {
    grid-area: tabs;
    display: flex;
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
    box-shadow: inset 0 2px 0 var(--ui-accent);
  }
</style>
