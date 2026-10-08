<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { deserialize } from '$app/forms';
  import { replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import { createSupabaseBrowserClient } from '$lib/supabase/client';
  import { watchMotionNode } from '$lib/realtime/motion-channel';
  import { canvasUploadPrefix } from '$lib/canvas/upload-kind';
  import { registerUpload } from '$lib/motion/fonts/ops';
  import Plus from '@lucide/svelte/icons/plus';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import CompositionSettings from '$lib/components/motion/CompositionSettings.svelte';
  import { SAVE_TONE, SaveState, TimeDisplay, clockLabel, compositionLabel, compositionShort, DISPLAY_NAME, isTap } from '$lib/motion/editor-bar';
  import Keyboard from '@lucide/svelte/icons/keyboard';
  import LayoutTemplate from '@lucide/svelte/icons/layout-template';
  import Upload from '@lucide/svelte/icons/upload';
  import ShortcutHelp from '$lib/components/motion/ShortcutHelp.svelte';
  import { decodePeaks } from '$lib/motion/peaks-decode';
  import IconButton from '$lib/components/motion/IconButton.svelte';
  import { Action, Caption, menuSections, type ActionId } from '$lib/motion/actions';
  import { ClipOp, runClipOp } from '$lib/motion/clip-ops';
  import { PickMode, clipActions, parentChoices } from '$lib/motion/clip-bar';
  import type { Point } from '$lib/motion/press-menu';
  import ClipBar from '$lib/components/motion/ClipBar.svelte';
  import OverflowMenu, { type MenuBlock } from '$lib/components/motion/OverflowMenu.svelte';
  import { CHAT_PLACE, ChatPlace, DEFAULT_LAYOUT, Panel, Side, flip, readLayout, sideWidth, timelineHeight, toggleSide, viewportOf, Viewport, writeLayout, type EditorLayout, type LayoutStore } from '$lib/motion/editor-layout';
  import { provideSelection } from '$lib/motion/selection-context';
  import { addAdjustment, mergeView, pathNames, precompose, viewOf } from '$lib/motion/precomp';
  import { Lens, addLens } from '$lib/motion/glass/ops';
  import { SPRINGS } from '$lib/motion/spring';
  import GraphEditor from '$lib/components/motion/GraphEditor.svelte';
  import { nullFromSelection } from '$lib/motion/parent-ops';
  import MotionPreview from '$lib/components/motion/MotionPreview.svelte';
  import ZoomStage from '$lib/components/motion/ZoomStage.svelte';
  import type { StreamData } from '$lib/components/brand-agent/chat-session.svelte';
  import { CHECK_REQUEST, FRAMES_REQUEST, Head, Landing, adoptAgentAssets, agentDraft, landTurn, type AgentDraft, type CheckRequest, type FramesRequest } from '$lib/motion/frames-request';
  import { Agent, showsStart } from '$lib/motion/start-prompt';
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
  import TextPathOverlay from '$lib/components/motion/TextPathOverlay.svelte';
  import { Align, addMarker, alignClips, allMarkers, clipsTo, distributeClips, trimClipsAt, loopFrame, nudgeClips, sequenceClips, setWorkArea, staggerClips } from '$lib/motion/organize';
  import ExportDialog from '$lib/components/motion/ExportDialog.svelte';
  import InteractivePanel from '$lib/components/motion/InteractivePanel.svelte';
  import { Liveness } from '$lib/motion/interactive/settings';
  import { applyInteractivePreset } from '$lib/motion/interactive/presets';
  import { InputKey } from '$lib/motion/expression/inputs';
  import TemplateDialog from '$lib/components/motion/TemplateDialog.svelte';
  import type { FrameSource } from '$lib/motion/export/browser-render';
  import TemplateLibrary from '$lib/components/motion/TemplateLibrary.svelte';
  import TemplateInspector from '$lib/components/motion/TemplateInspector.svelte';
  import { insertTemplate, isLockedComp, type TemplateEntry } from '$lib/motion/template/library';
  import SoundDialog, { type Made, type SoundKind } from '$lib/components/motion/SoundDialog.svelte';
  import ChatPanel from '$lib/components/brand-agent/ChatPanel.svelte';
  import SideColumn from '$lib/components/motion/SideColumn.svelte';
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
    keyframeFrames,
    pasteKeyframes,
    type KeyBoard,
    type KeyRef,
    type OpResult
  } from '$lib/motion/timeline';
  import { amend, canRedo, canUndo, previousSource, record, redo, startHistory, undo, type History } from '$lib/motion/history';
  import { Reveal, Snap, clampZoom } from '$lib/motion/timeline-view';
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
  import PublishDialog from '$lib/components/gallery/PublishDialog.svelte';
  import RemixBanner from '$lib/components/gallery/RemixBanner.svelte';
  import DocFields from '$lib/components/motion/DocFields.svelte';
  import { BRAND_PARAM, BRAND_REMIX_PROMPT } from '$lib/gallery/model';
  import { BRIEF_PARAM } from '$lib/motion/video-brief';
  import { PrefillMode, type ChatPrefill } from '$lib/components/brand-agent/chat-prefill';
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
  let publishing = $state(false);
  let listed = $state(data.gallery.listed);
  let brandAsk = $state<ChatPrefill | null>(null);
  let browsing = $state(false);
  let templates = $state<TemplateEntry[]>(data.templates);
  let previewDoc = $state<MotionDoc | null>(null);
  let draft = $state<AgentDraft>(null);
  let sounding = $state<SoundKind | null>(null);
  let madeAssets = $state<PageData['assets']>([]);
  let analyses = $state<Record<string, AudioAnalysis>>({});
  let decodedPeaks = $state<Record<string, number[]>>({});
  const waveforms = $derived({ ...decodedPeaks, ...Object.fromEntries(Object.entries(analyses).map(([id, a]) => [id, a.amp])) });
  const analysing = new Set<string>();
  let sheet = $state<Sheet>(Sheet.None);
  let inspectorTab = $state<InspectorTab>(InspectorTab.Properties);
  let preview = $state<MotionPreview | null>(null);
  let zoomStage = $state<ZoomStage | null>(null);
  let reveal = $state(Reveal.Animated);
  let helpOpen = $state(false);
  let layout = $state<EditorLayout>(DEFAULT_LAYOUT);
  let chatReload = $state(0);
  let agentBusy = $state(false);
  let display = $state(TimeDisplay.Timecode);
  let width = $state(1440);
  const viewport = $derived(viewportOf(width));
  const chatPlace = $derived(CHAT_PLACE[viewport]);
  let settingsOpen = $state(false);
  let moreOpen = $state(false);
  let clockOpen = $state(false);
  let toolsOpen = $state(false);
  let pickMode = $state(PickMode.One);
  let clipMenu = $state<{ at: Point | null; parents: boolean } | null>(null);
  let menuAt: Point | null = null;
  let pressAt: { x: number; y: number } | null = null;
  let pressedMenu: unknown = null;

  function browserStore(): LayoutStore | null {
    try {
      return localStorage;
    } catch {
      return null;
    }
  }

  onMount(() => {
    layout = readLayout(browserStore());
    const url = new URL(window.location.href);
    if (url.searchParams.has(BRAND_PARAM)) {
      void askBrand();
    }
    const brief = url.searchParams.get(BRIEF_PARAM);
    if (brief) {
      void sendBrief(url, brief);
    }
    return watchMotionNode(supabase, data.node.id, () => void pullExternalEdit());
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
  const doc = $derived(viewOf(draft?.doc ?? history.present, compPath));
  const beats = $derived(hitFrames(doc, analyses, Hit.Beats));
  const assets = $derived([...madeAssets, ...data.assets]);
  const assetUrls = $derived(Object.fromEntries(assets.filter((a) => a.url).map((a) => [a.id, a.url as string])));
  let interactive = $state(false);
  let tiltX = $state(0);
  let tiltY = $state(0);
  const html = $derived(composeHtml({ doc: previewDoc ?? doc, tokens: data.tokens, assets: assetUrls, analyses, liveness: interactive ? Liveness.Live : Liveness.Baked }));
  const selected = $derived(selection.length === 1 ? (findClip(doc, selection[0])?.clip ?? null) : null);
  const blank = $derived(!path.length && showsStart(doc, agentBusy ? Agent.Working : Agent.Idle));

  const OPEN_CHAT: Record<ChatPlace, () => void> = {
    [ChatPlace.Column]: () => relayout({ chat: Panel.Open, inspector: Panel.Open, side: Side.Chat }),
    [ChatPlace.Drawer]: () => (sheet = Sheet.Agent),
    [ChatPlace.Sheet]: () => (sheet = Sheet.Agent)
  };

  async function askAgent() {
    OPEN_CHAT[chatPlace]();
    await tick();
    document.querySelector<HTMLTextAreaElement>('aside.chat textarea')?.focus();
  }

  async function sendBrief(url: URL, brief: string) {
    url.searchParams.delete(BRIEF_PARAM);
    replaceState(url, page.state);
    brandAsk = { text: brief, at: Date.now(), mode: PrefillMode.Send };
    await askAgent();
  }

  async function askBrand() {
    brandAsk = { text: BRAND_REMIX_PROMPT, at: Date.now() };
    await askAgent();
  }

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

  function decodeMissing(ids: string[]) {
    for (const id of ids.filter((id) => !analyses[id] && assetUrls[id])) {
      decodePeaks(id, assetUrls[id])
        .then((peaks) => (decodedPeaks = { ...decodedPeaks, [id]: peaks }))
        .catch(() => {});
    }
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
    void analyse(fresh)
      .catch(() => {})
      .then(() => decodeMissing(fresh));
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

  async function pullExternalEdit() {
    if (agentBusy) {
      return;
    }
    const res = await fetch(agentUrl);
    const body = (await res.json().catch(() => null)) as { head?: { version: number; doc: MotionDoc; actorKind: string } } | null;
    if (!body?.head || body.head.version <= version || body.head.actorKind !== 'agent') {
      return;
    }
    history = record(history, body.head.doc);
    version = body.head.version;
    selection = selection.filter((id) => findClip(body.head!.doc, id));
    chatReload++;
  }

  const LAND: Record<Landing, (shown: AgentDraft) => void> = {
    [Landing.Head]: () => (draft = null),
    [Landing.KeepDraft]: (shown) => {
      history = record(history, shown!.doc);
      draft = null;
      scheduleSave('Kept the agent edits');
    },
    [Landing.Nothing]: () => {}
  };

  async function pullAgentEdit() {
    const head = await pullHead();
    LAND[landTurn(draft, head)](draft);
  }

  async function pullHead(): Promise<Head> {
    for (let i = 0; i < HEAD_POLL_TRIES; i++) {
      const res = await fetch(agentUrl);
      const body = (await res.json().catch(() => null)) as { head?: { version: number; doc: MotionDoc } } | null;
      if (body?.head && body.head.version > version) {
        history = record(history, body.head.doc);
        version = body.head.version;
        selection = selection.filter((id) => findClip(body.head!.doc, id));
        return Head.Newer;
      }
      await new Promise((r) => setTimeout(r, HEAD_POLL_MS));
    }
    return Head.Same;
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
    draft = agentDraft(draft, part);
    madeAssets = adoptAgentAssets(madeAssets, (part.data as { assets?: PageData['assets'] } | null)?.assets);
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
    Adjustment: (id) => addAdjustment(doc, { from: frame }, { clip: id, track: newId() }),
    LiquidGlass: (id) => addLens(doc, Lens.Glass, { from: frame, durationInFrames: COMPONENTS.LiquidGlass.durationInFrames, props: {}, path: [], spring: SPRINGS.soft, fadeIn: 0, fadeOut: 0 }, { clip: id, track: newId() }),
    LiquidBlob: (id) => addLens(doc, Lens.Blob, { from: frame, durationInFrames: COMPONENTS.LiquidBlob.durationInFrames, props: {}, path: [], spring: SPRINGS.soft, fadeIn: 0, fadeOut: 0 }, { clip: id, track: newId() })
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

  function insertEntry(entry: TemplateEntry) {
    browsing = false;
    const placed = insertTemplate(doc, entry, { from: frame, newId });
    apply(placed, `Inserted ${entry.template.name}`);
    if (placed.ok) {
      selection = [placed.clipId];
    }
  }

  function enterComp(comp: string) {
    if (isLockedComp(doc, comp)) {
      notice = 'This is a template: change its fields in Properties, or Detach it to edit its structure.';
      return;
    }
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

  function clipOp(op: ClipOp, parent: string | null = null) {
    const result = runClipOp(op, { doc, selection, frame, parent, newId });
    if (!result.ok) {
      return;
    }
    edit(result.doc, result.summary);
    selection = result.selection;
  }

  const split = () => clipOp(ClipOp.Split);

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

  const duplicate = () => clipOp(ClipOp.Duplicate);

  function remove() {
    if (keySelection.length) {
      apply(deleteKeyframes(doc, keySelection), 'Deleted keyframes');
      keySelection = [];
      return;
    }
    if (!selection.length) {
      return;
    }
    clipOp(ClipOp.Delete);
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

  function docFrames(d: MotionDoc): FrameSource {
    const source = composeHtml({ doc: d, tokens: data.tokens, assets: assetUrls, analyses });
    return (times, size, onFrame, signal) => (preview ? preview.render(times, size, onFrame, signal, source) : Promise.reject(new Error('the preview is still loading')));
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
    [ChatPlace.Column]: () => relayout(toggleSide(layout, Side.Chat)),
    [ChatPlace.Drawer]: () => (sheet = sheet === Sheet.Agent ? Sheet.None : Sheet.Agent),
    [ChatPlace.Sheet]: () => (sheet = sheet === Sheet.Agent ? Sheet.None : Sheet.Agent)
  };
  const docked = $derived(chatPlace === ChatPlace.Column);
  const sideOpen = $derived(layout.chat === Panel.Open || layout.inspector === Panel.Open);
  const chatShown = $derived(docked ? sideOpen && layout.side === Side.Chat : sheet === Sheet.Agent);
  const propsShown = $derived(docked ? sideOpen && layout.side === Side.Properties : layout.inspector === Panel.Open);
  const toggleInspector = () => relayout(docked ? toggleSide(layout, Side.Properties) : { inspector: flip(layout.inspector) });

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
    [Command.PreviewZoomIn]: () => zoomStage?.zoomIn(),
    [Command.PreviewZoomOut]: () => zoomStage?.zoomOut(),
    [Command.PreviewFit]: () => zoomStage?.fit(),
    [Command.PreviewActual]: () => zoomStage?.actual(),
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
    [Command.ToggleInspector]: toggleInspector,
    [Command.Help]: () => (helpOpen = !helpOpen),
    [Command.Precompose]: precomposeSelection
  };

  const TOOL_RUN: Partial<Record<ActionId, () => void>> = {
    ...COMMANDS,
    [Action.NullFromSelection]: groupUnderNull,
    [Action.ClearWorkArea]: () => apply(setWorkArea(doc, null), 'Cleared the work area'),
    [Action.GraphMode]: () => (graphOpen = !graphOpen),
    [Action.MarkBeats]: markBeats,
    [Action.CutToBeat]: cutSelectionToBeat
  };

  const NEEDS_SELECTION = new Set<ActionId>([Action.NullFromSelection, Action.Precompose, Action.StartHere, Action.EndHere, Action.TrimIn, Action.TrimOut, Action.NudgeBack, Action.NudgeForward, Action.NudgeBackMore, Action.NudgeForwardMore, Action.CutToBeat]);
  const NEEDS_BEATS = new Set<ActionId>([Action.MarkBeats, Action.CutToBeat]);

  const toolSections = $derived<MenuBlock[]>([
    ...(selection.length > 1 ? [{ section: 'Arrange', items: Object.entries(ARRANGE).map(([id, op]) => ({ label: op.label, run: () => arrange(id) })) }] : []),
    ...menuSections().map(({ section, ids }) => ({
      section,
      items: ids
        .filter((id) => !NEEDS_BEATS.has(id) || beats.length > 0)
        .map((id) => ({
          id,
          run: TOOL_RUN[id] ?? (() => {}),
          disabled: (NEEDS_SELECTION.has(id) && !selection.length) || (id === Action.ClearWorkArea && !doc.workArea),
          pressed: id === Action.GraphMode ? graphOpen : undefined
        }))
    }))
  ]);

  function showProperties() {
    if (viewport === Viewport.Phone) {
      sheet = Sheet.Properties;
      return;
    }
    if (!propsShown) {
      toggleInspector();
    }
  }

  const CLIP_RUN: Partial<Record<ActionId, () => void>> = {
    [Action.Split]: split,
    [Action.Duplicate]: duplicate,
    [Action.Delete]: remove,
    [Action.OpenComp]: () => selected?.component === 'Precomp' && enterComp(String(selected.props.comp)),
    [Action.ParentTo]: () => (clipMenu = { at: menuAt, parents: true }),
    [Action.SelectSeveral]: () => (pickMode = PickMode.Many),
    [Action.ClipProperties]: showProperties
  };

  function runFromBar(id: ActionId) {
    menuAt = { x: innerWidth / 2, y: innerHeight / 3 };
    clipMenu = null;
    CLIP_RUN[id]?.();
  }

  function openClipMenu(at: Point) {
    menuAt = at;
    clipMenu = { at, parents: false };
  }

  const clipBarShown = $derived(selection.length > 0 && (viewport !== Viewport.Desktop || pickMode === PickMode.Many));

  const clipSections = $derived<MenuBlock[]>(
    clipMenu?.parents
      ? [{ section: 'Parent to', items: parentChoices(doc, selection).map((choice) => ({ label: choice.name, run: () => clipOp(ClipOp.Parent, choice.id) })) }]
      : [{ section: 'Clip', items: clipActions(doc, selection).map((id) => ({ id, run: () => CLIP_RUN[id]?.() })) }]
  );

  $effect(() => {
    if (!selection.length) {
      pickMode = PickMode.One;
    }
  });

  function pressDown(e: PointerEvent) {
    pressAt = { x: e.clientX, y: e.clientY };
    pressedMenu = clipMenu;
  }

  function closePopovers(e: PointerEvent) {
    const from = pressAt;
    pressAt = null;
    if (!from || !isTap(from, { x: e.clientX, y: e.clientY })) {
      return;
    }
    if ((e.target as HTMLElement | null)?.closest('.popover-anchor, [role=menu]')) {
      return;
    }
    settingsOpen = false;
    clockOpen = false;
    toolsOpen = false;
    if (clipMenu === pressedMenu) {
      clipMenu = null;
    }
  }

  function onKey(e: KeyboardEvent) {
    if ((settingsOpen || clockOpen || toolsOpen || clipMenu) && e.key === 'Escape') {
      settingsOpen = false;
      clockOpen = false;
      toolsOpen = false;
      clipMenu = null;
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
<svelte:window bind:innerWidth={width} onkeydown={onKey} onpointerdown={pressDown} onpointerup={closePopovers} />

<div class="editor" data-testid="motion-editor" data-viewport={viewport}>
  <header class="bar">
    <div class="group lead">
      <IconButton action={Action.Back} href={`/p/${data.projectId}/c/${data.canvas.id}`} label={`Back to ${data.canvas.name}`} />
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
      <IconButton action={Action.GoStart} onclick={COMMANDS[Command.GoStart]} />
      <IconButton action={Action.StepBack} class="step" onclick={COMMANDS[Command.StepBack]} />
      <IconButton action={playing ? Action.Pause : Action.Play} class="play" fill="currentColor" onclick={COMMANDS[Command.TogglePlay]} />
      <IconButton action={Action.StepForward} class="step" onclick={COMMANDS[Command.StepForward]} />
      <IconButton action={Action.GoEnd} onclick={COMMANDS[Command.GoEnd]} />
      <div class="popover-anchor">
        <button type="button" class="clock" aria-haspopup="menu" aria-expanded={clockOpen} aria-label={`Time display: ${DISPLAY_NAME[display]}`} data-testid="clock" onclick={() => (clockOpen = !clockOpen)}>
          <span data-testid="timecode"><b>{clockLabel(frame, doc.fps, display)}</b> <i>/ {clockLabel(doc.durationInFrames, doc.fps, display)}</i></span><ChevronDown size={12} />
        </button>
        {#if clockOpen}
          <div class="menu more clock-menu" role="menu">
            {#each Object.values(TimeDisplay) as option (option)}
              <button type="button" role="menuitemradio" aria-checked={display === option} onclick={() => ((display = option), (clockOpen = false))}><span>{DISPLAY_NAME[option]}</span><kbd>{clockLabel(frame, doc.fps, option)}</kbd></button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div class="group trail" data-testid="bar-trail">
      <IconButton action={Action.Undo} disabled={!canUndo(history)} onclick={undoEdit} />
      <IconButton action={Action.Redo} disabled={!canRedo(history)} onclick={redoEdit} />
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
      {#if !docked}
        <IconButton action={Action.ToggleInspector} class="toggle" pressed={propsShown} data-testid="toggle-inspector" onclick={COMMANDS[Command.ToggleInspector]} />
        <IconButton action={Action.ToggleChat} class="toggle" pressed={chatShown} data-testid="toggle-chat" onclick={COMMANDS[Command.ToggleChat]} />
      {/if}
      <button type="button" class="secondary wide" onclick={() => (leaveTo(0), (templating = true))} data-testid="template-open">Template</button>
      <button type="button" class="secondary wide" onclick={() => (leaveTo(0), (publishing = true))} data-testid="publish-open">{listed ? 'In gallery' : 'Publish'}</button>
      <div class="popover-anchor narrow">
        <IconButton action={Action.More} aria-expanded={moreOpen} data-testid="more-actions" onclick={() => (moreOpen = !moreOpen)} />
        {#if moreOpen}
          <div class="menu more" role="menu">
            <button type="button" role="menuitem" onclick={() => ((moreOpen = false), leaveTo(0), (templating = true))}><LayoutTemplate size={14} /><span>Template</span></button>
            <button type="button" role="menuitem" onclick={() => ((moreOpen = false), leaveTo(0), (publishing = true))}><Upload size={14} /><span>{listed ? 'In gallery' : 'Publish'}</span></button>
            <button type="button" role="menuitem" data-testid="guide-open-menu" onclick={() => ((moreOpen = false), COMMANDS[Command.Help]())}><Keyboard size={14} /><span>Keyboard & gestures</span><kbd>?</kbd></button>
          </div>
        {/if}
      </div>
      <button type="button" class="render" onclick={() => (leaveTo(0), (exporting = true))} data-testid="export-open">Export</button>
    </div>
  </header>

  {#if data.gallery.remixOf}
    <RemixBanner origin={data.gallery.remixOf} onbrand={askBrand} />
  {/if}

  {#if publishing}
    <PublishDialog
      actionUrl={editorUrl}
      {doc}
      assets={assetUrls}
      tokens={data.tokens}
      name={data.node.name ?? ''}
      {listed}
      saved={saveState === SaveState.Saved}
      onlisted={(item) => (listed = item)}
      onclose={() => (publishing = false)}
    />
  {/if}

  {#if sounding}
    <SoundDialog kind={sounding} {editorUrl} seconds={doc.durationInFrames / doc.fps} onclose={() => (sounding = null)} onmade={(made) => placeSound(sounding ?? 'voice', made)} />
  {/if}

  {#if clipMenu && selection.length}
    <OverflowMenu sections={clipSections} at={clipMenu.at} label={clipMenu.parents ? 'Parent to' : 'Clip'} onclose={() => (clipMenu = null)} />
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
      tokens={data.tokens}
      {analyses}
      server={{ ...data.serverRender, version, saved: saveState === SaveState.Saved, assetHref: (id: string) => `/p/${data.projectId}/c/${data.canvas.id}/assets/${id}` }}
      onpresets={() => ((exporting = false), (interactive = true))}
      onclose={() => (exporting = false)}
    />
  {/if}

  {#if browsing}
    <TemplateLibrary
      {templates}
      {doc}
      selectedComp={selected?.component === 'Precomp' ? String(selected.props.comp) : null}
      {frame}
      {editorUrl}
      compose={(d) => composeHtml({ doc: d, tokens: data.tokens, assets: assetUrls, analyses })}
      oninsert={insertEntry}
      onsaved={(entry) => ((templates = [...templates, entry]), (notice = `Saved ${entry.template.name} to the templates.`))}
      onremoved={(id) => (templates = templates.filter((t) => t.id !== id))}
      onclose={() => (browsing = false)}
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
      {assetUrls}
      scope={{ orgId: data.orgId, projectId: data.projectId, nodeId: data.node.id }}
      framesFor={docFrames}
      onchange={apply}
      onpreview={(next) => (previewDoc = next)}
      onclose={() => (templating = false)}
    />
  {/if}

  <div class="body" bind:this={body} style={`--tl-h: ${layout.timelinePx}px; --side-w: ${sideWidth(layout.sidePx, width)}px;`} class:coding={inspectorTab === InspectorTab.Code && selected?.component === 'Custom'} class:no-props={!docked && layout.inspector === Panel.Closed} class:no-chat={!docked && layout.chat === Panel.Closed} class:no-side={docked && !sideOpen}>
    <section class="stage" aria-label="Preview">
      <ZoomStage bind:this={zoomStage} frame={{ width: doc.width, height: doc.height }} onspace={COMMANDS[Command.TogglePlay]}>
      <MotionPreview bind:this={preview} {html} width={doc.width} height={doc.height} fps={doc.fps} bind:frame bind:playing live={interactive ? { [InputKey.TiltX]: tiltX, [InputKey.TiltY]: tiltY } : null}>
        {#if !playing}<SelectionOverlay {doc} {frame} {html} measure={() => preview?.measure() ?? Promise.resolve({})} onpreview={(next) => (previewDoc = next)} onchange={edit} />{/if}
        {#if selected?.mask && !playing && frame >= selected.from && frame < selected.from + selected.durationInFrames}<MaskOverlay {doc} clip={selected} {frame} onchange={edit} />{/if}
        {#if selected?.component === 'Shape' && selected.props.shape === 'path' && !playing && frame >= selected.from && frame < selected.from + selected.durationInFrames}<PenOverlay {doc} clip={selected} onchange={edit} />{/if}
        {#if selected?.path && !playing}<MotionPathOverlay {doc} clip={selected} {frame} onchange={edit} />{/if}
        {#if selected?.textPath && !playing}<TextPathOverlay {doc} clip={selected} {frame} />{/if}
      </MotionPreview>
      </ZoomStage>
      <div class="live-bar">
        <InteractivePanel bind:active={interactive} bind:tiltX bind:tiltY clipId={selected?.id ?? null} onpreset={(preset) => apply(applyInteractivePreset(doc, preset, selected?.id ?? null), preset)} />
      </div>
      {#if blank}
        <div class="empty-state" data-testid="empty-state">
          <p>Start with a template, a clip or a prompt</p>
          <div class="empty-actions">
            <button type="button" class="secondary" onclick={() => (templating = true)}>Template…</button>
            <button type="button" class="secondary" onclick={() => (adding = true)}>Add element</button>
            <button type="button" class="secondary" onclick={askAgent}>Ask the agent</button>
          </div>
        </div>
      {/if}
    </section>

    <SideColumn place={chatPlace} side={layout.side} onside={(side) => relayout({ side })} widthPx={sideWidth(layout.sidePx, width)} onwidth={(sidePx) => (layout = { ...layout, sidePx })} oncommit={() => relayout({})} busy={agentBusy}>
    {#snippet properties()}
    <aside class="props" class:open={sheet === Sheet.Properties} aria-label="Properties">
      <div class="sheet-head"><span>Properties</span><IconButton action={Action.Close} onclick={() => (sheet = Sheet.None)} /></div>
      {#if cameraOpen && !selection.length}
        <CameraInspector {doc} {frame} onchange={edit} />
        <LookInspector {doc} onchange={edit} />
      {:else if selected?.component === 'Precomp' && isLockedComp(doc, String(selected.props.comp))}
        <TemplateInspector {doc} clip={selected} {assets} onchange={edit} />
      {:else if selected}
        <MotionInspector {doc} {analyses} clip={selected} tokens={data.tokens} {assets} {frame} previousSource={(name) => previousSource(history, name)} composeHref={composeEditorPath({ projectId: data.projectId, nodeId: data.node.id })} bind:tab={inspectorTab} onchange={edit} onuploadfont={uploadFont} onopen={enterComp} />
        {#if selected.component === 'Device3D'}<DevicePresets {doc} clip={selected} onchange={edit} />{/if}
        {#if selected.component === 'Video'}<TimeRemap {doc} clip={selected} {frame} onchange={edit} />{/if}
        {#if selected.component === 'Particles'}<ParticlePresets {doc} clip={selected} onchange={edit} />{/if}
        {#if THREE_D_COMPONENTS.includes(selected.component)}<LookInspector {doc} onchange={edit} />{/if}
      {:else}
        <DocFields {doc} {assets} onchange={edit} />
        <div class="composition" data-testid="composition-inspector">
          <header class="composition-head"><span>Composition</span>{#if selection.length > 1}<em>{selection.length} clips selected</em>{/if}</header>
          <CompositionSettings {doc} onchange={apply} />
        </div>
      {/if}
    </aside>
    {/snippet}
    {#snippet chat()}
    <aside class="chat" class:open={sheet === Sheet.Agent} aria-label="Agent">
      <div class="sheet-head"><span>Agent</span><IconButton action={Action.Close} onclick={() => (sheet = Sheet.None)} /></div>
      <ChatPanel projectId={data.projectId} motionNodeId={data.node.id} reload={chatReload} prefill={brandAsk} context={() => ({ selection })} onturnend={() => void pullAgentEdit()} ondata={onAgentData} onbusy={(busy) => (agentBusy = busy)} />
    </aside>
    {/snippet}
    </SideColumn>

    <section class="timeline-area" aria-label="Timeline">
      <div class="resize" role="separator" aria-orientation="horizontal" aria-label="Resize the timeline" aria-valuenow={layout.timelinePx} data-testid="timeline-resize" onpointerdown={startResize} ondblclick={() => relayout({ timelinePx: DEFAULT_LAYOUT.timelinePx })}></div>

      {#if clipBarShown}
        <ClipBar {doc} {selection} pick={pickMode} onrun={runFromBar} ondone={() => (pickMode = PickMode.One)} />
      {/if}

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
                <span class="menu-head">Templates</span>
                <button type="button" role="menuitem" data-testid="open-templates" onclick={() => ((adding = false), (browsing = true))}>Browse templates…</button>
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
        {#if !clipBarShown || keySelection.length}
          <IconButton action={Action.Split} size={14} disabled={!selection.length} onclick={split} />
          <IconButton action={Action.Duplicate} size={14} disabled={!selection.length} onclick={duplicate} />
          <IconButton action={Action.Delete} size={14} disabled={!selection.length && !keySelection.length} onclick={remove} />
        {/if}
        <IconButton action={Action.Snap} size={14} caption={Caption.Wide} pressed={snap === Snap.On} onclick={() => (snap = snap === Snap.On ? Snap.Off : Snap.On)} />
        {#if notice}<span class="notice" role="status">{notice}</span>{/if}
        <span class="spacer"></span>
        <div class="popover-anchor">
          <IconButton action={Action.More} size={14} aria-expanded={toolsOpen} data-testid="timeline-more" onclick={() => (toolsOpen = !toolsOpen)} />
          {#if toolsOpen}<OverflowMenu sections={toolSections} onclose={() => (toolsOpen = false)} />{/if}
        </div>
      </div>

      <div class="tl">
        {#if graphOpen}
          <GraphEditor {doc} {frame} {selection} bind:keySelection camera={cameraOpen} onchange={edit} />
        {:else}
          <MotionTimeline pick={pickMode} onmenu={(_, at) => openClipMenu(at)} {doc} bind:frame bind:selection bind:keySelection bind:camera={cameraOpen} bind:zoom {snap} {waveforms} {beats} {assetUrls} {reveal} onchange={edit} onopen={enterComp} />
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
    --ui-ink-2: var(--ui-text-2);
    --ui-ink-3: var(--ui-text-3);
    --ui-line: transparent;
    --ui-line-strong: transparent;
    --border: transparent;
  }

  [data-viewport='tablet'],
  [data-viewport='phone'] {
    --ui-hit: 44px;
  }

  [data-viewport='phone'] {
    --ui-hit-gap: 12px;
  }

  .editor :global(:is(input:not([type='checkbox'], [type='radio'], [type='range'], [type='color']), select, textarea)) {
    background-color: var(--ui-field);
  }

  .editor :global(:focus-visible) {
    outline: 1px solid var(--ui-accent);
    outline-offset: -1px;
  }

  .bar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: stretch;
    gap: var(--ui-space-4);
    height: calc(var(--ui-hit) + var(--ui-space-3));
    padding: 0 var(--ui-space-2);
    background: var(--ui-bg);
    font-size: var(--ui-text-sm);
    flex-shrink: 0;
  }

  .group {
    display: flex;
    align-items: center;
    gap: var(--ui-hit-gap);
    min-width: 0;
  }

  .lead {
    gap: var(--ui-space-1);
  }

  .transport {
    justify-content: center;
  }

  .trail {
    justify-content: flex-end;
  }

  .tool,
  .clock,
  .crumb {
    border: 0;
    border-radius: 0;
    background: none;
    cursor: pointer;
  }

  .transport :global(.play) {
    color: var(--ui-ink);
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
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: var(--ui-space-2);
    padding: 4px 6px;
    color: var(--ui-text-3);
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
    height: var(--ui-hit);
    padding: 0 var(--ui-space-3);
    background: var(--ui-field);
    color: var(--ui-ink-2);
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .chip:hover,
  .chip[aria-expanded='true'] {
    background: var(--ui-hover);
    color: var(--ui-ink);
  }

  .popover {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 40;
    width: 300px;
    padding: var(--ui-space-4);
    background: var(--ui-raised);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.14);
  }

  .popover-head {
    display: block;
    margin-bottom: var(--ui-space-3);
    font-size: var(--ui-text-xs);
    color: var(--ui-text-3);
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

  .secondary,
  .render {
    height: var(--ui-hit);
    padding: 0 var(--ui-space-4);
    font-size: var(--ui-text-sm);
    font-weight: 600;
    white-space: nowrap;
  }

  .secondary {
    background: var(--ui-field);
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

  [data-viewport='desktop'] .body {
    grid-template-columns: minmax(0, 1fr) var(--side-w);
  }

  [data-viewport='desktop'] .body.no-side {
    grid-template-columns: minmax(0, 1fr) 0px;
  }

  [data-viewport='desktop'] .body > :global([data-testid='side-column']) {
    grid-column: 2;
    grid-row: 1 / 3;
  }

  [data-viewport='desktop'] .body.no-side > :global([data-testid='side-column']) {
    display: none;
  }

  [data-viewport='desktop'] .timeline-area {
    grid-column: 1;
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

  .stage {
    position: relative;
  }

  .live-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 0 var(--ui-space-4);
    background: var(--ui-surface);
    color: var(--ui-text-2);
    outline: none;
  }

  .empty-state {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--ui-space-3);
    padding: var(--ui-space-6);
    max-width: calc(100% - 32px);
    background: var(--ui-raised);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.1);
    outline: none !important;
  }

  .empty-state p {
    font-size: var(--ui-text-lg);
    font-weight: 600;
    text-align: center;
  }

  .empty-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--ui-space-2);
  }

  .composition {
    padding: 0 var(--ui-space-4) var(--ui-space-4);
  }

  .composition-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 40px;
    margin-bottom: var(--ui-space-2);
    font-size: var(--ui-text-xs);
    font-weight: 500;
    color: var(--ui-text-3);
  }

  .composition-head em {
    font-style: normal;
    font-family: var(--ui-mono);
    font-size: 10px;
    font-weight: 400;
    color: var(--ui-ink-3);
  }

  .props {
    grid-column: 2;
    grid-row: 1;
    min-height: 0;
    overflow: hidden;
  }

  .chat {
    --line: transparent;
    --line-2: transparent;
    --ink-soft: var(--ui-text-2);
    --ink-faint: var(--ui-text-3);
    --chat-field: var(--ui-field);
    --chat-gap: 2px;
    grid-column: 3;
    grid-row: 1 / 3;
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

  @media (pointer: coarse) {
    .resize {
      top: calc(var(--ui-space-2) - var(--ui-hit));
      height: var(--ui-hit);
    }

    .resize::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 50%;
      width: 40px;
      height: 4px;
      transform: translate(-50%, -50%);
      border-radius: 9999px;
      background: var(--ui-line);
    }

    .resize:hover {
      background: none;
    }
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--ui-hit-gap);
    height: calc(var(--ui-hit) + var(--ui-space-3));
    padding: 0 var(--ui-space-3);
    background: var(--ui-bg);
    font-size: var(--ui-text-sm);
    flex-shrink: 0;
  }

  .tool {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: var(--ui-hit);
    height: var(--ui-hit);
    color: var(--ui-ink-2);
  }

  .tool.text {
    padding: 0 var(--ui-space-2);
    color: var(--ui-ink);
  }

  .tool:hover:not(:disabled) {
    background: var(--ui-hover);
    color: var(--ui-ink);
  }

  .tool:disabled {
    color: var(--ui-ink-3);
    cursor: default;
  }

  .spacer {
    flex: 1;
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
    padding: var(--ui-space-2);
    background: var(--ui-raised);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.14);
  }

  .menu.more {
    top: calc(100% + 6px);
    bottom: auto;
    left: auto;
    right: 0;
    grid-template-columns: 220px;
  }

  .menu.more button {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
  }

  .menu.more kbd {
    margin-left: auto;
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    color: var(--ui-text-3);
  }

  .clock-menu {
    left: 0;
    right: auto;
    grid-template-columns: 180px;
  }

  .menu [aria-checked='true'] {
    color: var(--ui-accent);
  }

  @media (pointer: coarse) {
    .editor :global(:is(button, a[href], select, [role='button'], [role='slider'], label:has(> input[type='checkbox']), input:not([type='checkbox'], [type='radio'], [type='range'], [type='hidden']))) {
      min-height: var(--ui-hit);
    }

    .editor :global(:is(button, [role='button'], input[type='color']):not(.bar)) {
      min-width: var(--ui-hit);
    }

    .editor :global(:is(a[href], label:has(> input[type='checkbox']))) {
      display: inline-flex;
      align-items: center;
    }
  }

  .menu .col {
    display: flex;
    flex-direction: column;
  }

  .menu button {
    text-align: left;
    min-height: var(--ui-hit);
    padding: 0 var(--ui-space-3);
  }

  .menu button:hover {
    background: var(--ui-hover);
  }

  .menu-head {
    padding: var(--ui-space-3) var(--ui-space-3) var(--ui-space-1);
    font-size: var(--ui-text-xs);
    color: var(--ui-text-3);
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

  .chip .short,
  .narrow {
    display: none;
  }

  @media (max-width: 1599px) {
    .save {
      font-size: 0;
      gap: 0;
    }
  }

  @media (max-width: 1439px) {
    .chip .long {
      display: none;
    }

    .chip .short {
      display: inline;
    }
  }

  @media (max-width: 1359px) {
    .wide,
    .toolbar :global(.ib.wide) {
      display: none;
    }

    .narrow {
      display: block;
    }
  }

  [data-viewport='tablet'] .chip .long,
  [data-viewport='tablet'] .transport :global(.step),
  [data-viewport='tablet'] .crumbs,
  [data-viewport='tablet'] .slash {
    display: none;
  }

  [data-viewport='tablet'] .chip .short {
    display: inline;
  }

  [data-viewport='tablet'] .bar {
    grid-template-columns: auto minmax(0, 1fr) auto;
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
    background: var(--ui-raised);
    box-shadow: -12px 0 32px rgb(0 0 0 / 0.16);
  }

  [data-viewport='tablet'] .body {
    position: relative;
  }

  [data-viewport='tablet'] .chat .sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--ui-space-2) var(--ui-space-2) 0 var(--ui-space-4);
    font-size: var(--ui-text-xs);
    color: var(--ui-text-3);
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
    height: 56px;
    padding-left: var(--ui-space-2);
  }

  [data-viewport='phone'] .trail {
    grid-area: trail;
    height: 56px;
    padding-right: var(--ui-space-2);
  }

  [data-viewport='phone'] .transport {
    grid-area: transport;
    height: 64px;
    padding: 0 var(--ui-space-2);
    background: var(--ui-bg);
  }

  [data-viewport='phone'] .transport :global(.step),
  [data-viewport='phone'] .crumb:not(.current),
  [data-viewport='phone'] .slash,
  [data-viewport='phone'] .save,
  [data-viewport='phone'] .chip,
  [data-viewport='phone'] .trail :global(.toggle) {
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
    --stage-pad: 8px;
  }

  [data-viewport='phone'] .timeline-area {
    flex: 1;
    min-height: 160px;
  }

  [data-viewport='phone'] .resize {
    display: none;
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

  [data-viewport='phone'] .menu.more {
    top: 56px;
    grid-template-columns: 1fr;
  }

  [data-viewport='phone'] .props,
  [data-viewport='phone'] .chat {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 120px;
    height: 62vh;
    z-index: 30;
    display: none;
    flex-direction: column;
    background: var(--ui-raised);
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
    height: 56px;
    padding: 0 var(--ui-space-1) 0 var(--ui-space-4);
    font-size: var(--ui-text-xs);
    color: var(--ui-text-3);
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
    height: 56px;
  }

  .tabs button {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: var(--ui-text-3);
  }

  .tabs button.on {
    color: var(--ui-ink);
  }
</style>
