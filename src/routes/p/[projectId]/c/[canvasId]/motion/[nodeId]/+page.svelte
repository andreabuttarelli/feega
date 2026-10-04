<script lang="ts">
  import { deserialize } from '$app/forms';
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
  import MaskOverlay from '$lib/components/motion/MaskOverlay.svelte';
  import ExportDialog from '$lib/components/motion/ExportDialog.svelte';
  import SoundDialog, { type Made, type SoundKind } from '$lib/components/motion/SoundDialog.svelte';
  import ChatPanel from '$lib/components/brand-agent/ChatPanel.svelte';
  import { AssetKind, COMPONENTS, LIBRARY_IDS, TrackKind, type ComponentId } from '$lib/motion/components';
  import { FPS } from '$lib/motion/design';
  import { FORMATS, MOTION_FORMATS, MAX_SECONDS, findClip, formatOf, type MotionDoc, type MotionFormat } from '$lib/motion/doc';
  import {
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
  import { Snap, clampZoom, timecode } from '$lib/motion/timeline-view';
  import { InspectorTab, parseDecimal, secondsLabel } from '$lib/motion/inspector';
  import { Command, commandFor } from '$lib/motion/shortcuts';
  import { composeHtml } from '$lib/motion/hyperframes/compose';
  import { feegaTrailer } from '$lib/motion/trailer';
  import { loadPeaks } from '$lib/motion/waveform';
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

  const SaveState = { Saved: 'Saved', Saving: 'Saving…', Pending: 'Unsaved', Conflict: 'Reloaded the latest version', Failed: 'Not saved' } as const;
  type SaveState = (typeof SaveState)[keyof typeof SaveState];

  const Sheet = { None: 'none', Properties: 'properties', Agent: 'agent' } as const;
  type Sheet = (typeof Sheet)[keyof typeof Sheet];

  let { data }: { data: PageData } = $props();

  let history = $state<History>(startHistory(data.head.doc as MotionDoc));
  let version = $state(data.head.version);
  let selection = $state<string[]>([]);
  let cameraOpen = $state(false);
  let keySelection = $state<KeyRef[]>([]);
  let keyBoard: KeyBoard = [];
  let frame = $state(0);
  let playing = $state(false);
  let zoom = $state(1.5);
  let snap = $state(Snap.On);
  let saveState = $state<SaveState>(SaveState.Saved);
  let notice = $state('');
  let adding = $state(false);
  let exporting = $state(false);
  let sounding = $state<SoundKind | null>(null);
  let madeAssets = $state<PageData['assets']>([]);
  let waveforms = $state<Record<string, number[]>>({});
  const loadingWaves = new Set<string>();
  let sheet = $state<Sheet>(Sheet.None);
  let inspectorTab = $state<InspectorTab>(InspectorTab.Properties);
  let preview = $state<MotionPreview | null>(null);

  let lastEdit = { summary: '', at: 0 };
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let unsavedSummary = '';

  const doc = $derived(history.present);
  const assets = $derived([...madeAssets, ...data.assets]);
  const assetUrls = $derived(Object.fromEntries(assets.filter((a) => a.url).map((a) => [a.id, a.url as string])));
  const html = $derived(composeHtml({ doc, tokens: data.tokens, assets: assetUrls }));
  const selected = $derived(selection.length === 1 ? (findClip(doc, selection[0])?.clip ?? null) : null);
  const editorUrl = $derived(`/p/${data.projectId}/c/${data.canvas.id}/motion/${data.node.id}`);
  const agentUrl = $derived(`/api/v1/projects/${data.projectId}/motion/${data.node.id}/agent`);

  const soundAssets = $derived(findSoundAssets(doc));

  function findSoundAssets(d: MotionDoc): [string, string][] {
    const ids = new Set(d.tracks.flatMap((t) => t.clips.map((c) => (c.props as { assetId?: string | null }).assetId ?? '')));
    return [...ids].filter((id) => assetUrls[id] && assets.some((a) => a.id === id && (a.kind === AssetKind.Audio || a.kind === AssetKind.Video))).map((id) => [id, assetUrls[id]]);
  }

  $effect(() => {
    for (const [id, url] of soundAssets) {
      if (loadingWaves.has(id)) {
        continue;
      }
      loadingWaves.add(id);
      loadPeaks(url)
        .then((peaks) => (waveforms = { ...waveforms, [id]: peaks }))
        .catch(() => {});
    }
  });

  function edit(next: MotionDoc, summary: string) {
    const now = Date.now();
    history = summary === lastEdit.summary && now - lastEdit.at < COALESCE_MS ? amend(history, next) : record(history, next);
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
    compose: (d) => composeHtml({ doc: d, tokens: data.tokens, assets: assetUrls }),
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
    const agentHtml = composeHtml({ doc: request.doc, tokens: data.tokens, assets: assetUrls });
    const times = request.times.map((t) => Math.min(t, (request.doc.durationInFrames - 1) / FPS));
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

  function add(component: ComponentId) {
    adding = false;
    const id = newId();
    apply(addClip(doc, { component, from: frame }, id), `Added ${COMPONENTS[component].label}`);
    selection = [id];
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
    const durationInFrames = Math.max(FPS, Math.ceil(made.seconds * FPS));
    apply(addClip(doc, { component: 'Audio', from: frame, durationInFrames, props: { assetId: made.assetId } }, id), `Added ${SOUND_LABEL[kind].toLowerCase()}`);
    selection = [id];
  }

  function newTrack(kind: TrackKind) {
    apply(addTrack(doc, kind, newId()), 'Added a track');
  }

  function split() {
    for (const id of selection) {
      const result = splitClip(history.present, id, frame, newId());
      if (result.ok) {
        edit(result.doc, 'Split');
      }
    }
  }

  function groupUnderNull() {
    const id = newId();
    const result = nullFromSelection(history.present, selection, frame, id);
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
      const result = duplicateClip(history.present, id, copy);
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
    apply(setCanvas(doc, { durationInFrames: Math.round(seconds * FPS) }), 'Changed duration');
  }

  function exportFrames(...args: Parameters<MotionPreview['render']>) {
    if (!preview) {
      return Promise.reject(new Error('the preview is still loading'));
    }
    return preview.render(...args);
  }

  const COMMANDS: Record<Command, () => void> = {
    [Command.TogglePlay]: () => (playing = !playing),
    [Command.Delete]: remove,
    [Command.Split]: split,
    [Command.Duplicate]: duplicate,
    [Command.Undo]: undoEdit,
    [Command.Redo]: redoEdit,
    [Command.StepBack]: () => step(-1),
    [Command.StepForward]: () => step(1),
    [Command.SecondBack]: () => step(-FPS),
    [Command.SecondForward]: () => step(FPS),
    [Command.ZoomIn]: () => (zoom = clampZoom(zoom * ZOOM_STEP)),
    [Command.ZoomOut]: () => (zoom = clampZoom(zoom / ZOOM_STEP)),
    [Command.SelectAll]: () => (selection = doc.tracks.flatMap((t) => t.clips.map((c) => c.id))),
    [Command.Deselect]: () => {
      selection = [];
      keySelection = [];
    },
    [Command.PrevKeyframe]: () => jumpKey(Direction.Back),
    [Command.NextKeyframe]: () => jumpKey(Direction.Forward),
    [Command.Copy]: copyKeys,
    [Command.Paste]: pasteKeys
  };

  function onKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (exporting || sounding || target?.closest('input, textarea, select, [contenteditable="true"]')) {
      return;
    }
    const command = commandFor({ key: e.key, mod: e.metaKey || e.ctrlKey, shift: e.shiftKey });
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
      <input type="text" inputmode="decimal" title={`1–${MAX_SECONDS} s`} value={secondsLabel(doc.durationInFrames)} onchange={(e) => setDuration(e.currentTarget.value)} />
    </label>
    <span class="save" data-testid="save-state">{saveState} · v{version}</span>
    <button type="button" class="render" onclick={() => (exporting = true)} data-testid="export-open"><Film size={14} /> Export</button>
  </header>

  {#if sounding}
    <SoundDialog kind={sounding} {editorUrl} seconds={doc.durationInFrames / FPS} onclose={() => (sounding = null)} onmade={(made) => placeSound(sounding ?? 'voice', made)} />
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

  <div class="body" class:coding={inspectorTab === InspectorTab.Code && selected?.component === 'Custom'}>
    <section class="left">
      <div class="preview">
        <MotionPreview bind:this={preview} {html} width={doc.width} height={doc.height} bind:frame bind:playing>
          {#if selected?.mask && !playing && frame >= selected.from && frame < selected.from + selected.durationInFrames}<MaskOverlay {doc} clip={selected} {frame} onchange={edit} />{/if}
        </MotionPreview>
      </div>

      <div class="transport">
        <button type="button" aria-label={playing ? 'Pause' : 'Play'} onclick={() => (playing = !playing)}>
          {#if playing}<Pause size={14} />{:else}<Play size={14} />{/if}
        </button>
        <span class="tc" data-testid="timecode">{timecode(frame)} / {timecode(doc.durationInFrames)}</span>
        <span class="sep"></span>
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
        <button type="button" title="Split at playhead (S)" disabled={!selection.length} onclick={split}><Scissors size={14} /></button>
        <button type="button" title="Duplicate (⌘D)" disabled={!selection.length} onclick={duplicate}><Copy size={14} /></button>
        <button type="button" title="Create null from selection" data-testid="null-from-selection" disabled={!selection.length} onclick={groupUnderNull}><Crosshair size={14} /></button>
        <button type="button" title="Delete (Del)" disabled={!selection.length} onclick={remove}><Trash size={14} /></button>
        <button type="button" title="Undo (⌘Z)" disabled={!canUndo(history)} onclick={undoEdit}><Undo size={14} /></button>
        <button type="button" title="Redo (⇧⌘Z)" disabled={!canRedo(history)} onclick={redoEdit}><Redo size={14} /></button>
        <button type="button" title="Snap" class:on={snap === Snap.On} onclick={() => (snap = snap === Snap.On ? Snap.Off : Snap.On)}><Magnet size={14} /></button>
        <span class="sep"></span>
        <button type="button" title="Zoom out (−)" onclick={COMMANDS[Command.ZoomOut]}><ZoomOut size={14} /></button>
        <button type="button" title="Zoom in (+)" onclick={COMMANDS[Command.ZoomIn]}><ZoomIn size={14} /></button>
        {#if notice}<span class="notice" role="status">{notice}</span>{/if}
      </div>

      <div class="tl">
        <MotionTimeline {doc} bind:frame bind:selection bind:keySelection bind:camera={cameraOpen} {zoom} {snap} {waveforms} onchange={edit} />
      </div>
    </section>

    <aside class="props" class:open={sheet === Sheet.Properties} aria-label="Properties">
      <div class="sheet-head"><span>Properties</span><button type="button" aria-label="Close" onclick={() => (sheet = Sheet.None)}><X size={16} /></button></div>
      {#if cameraOpen && !selection.length}
        <CameraInspector {doc} {frame} onchange={edit} />
      {:else if selected}
        <MotionInspector {doc} clip={selected} tokens={data.tokens} {assets} {frame} previousSource={(name) => previousSource(history, name)} composeHref={composeEditorPath({ projectId: data.projectId, nodeId: data.node.id })} bind:tab={inspectorTab} onchange={edit} />
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
    background: var(--paper);
    color: var(--ink);
    font-family: 'DM Sans', system-ui, sans-serif;
    z-index: 10;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 48px;
    padding: 0 12px;
    border-bottom: 1px solid var(--line);
    font-size: 13px;
    flex-shrink: 0;
  }

  .back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--ink-soft);
  }

  .title {
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .field {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--ink-soft);
  }

  .field select,
  .field input {
    width: 72px;
    padding: 3px 5px;
    border: 1px solid var(--line);
    background: var(--paper);
    color: var(--ink);
    font: inherit;
  }

  .save {
    margin-left: auto;
    font-family: 'Fragment Mono', ui-monospace, monospace;
    font-size: 11px;
    color: var(--ink-soft);
  }

  .render {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--ink);
    color: var(--paper);
    font-size: 12px;
  }

  .render:disabled {
    opacity: 0.5;
  }

  .body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 280px 380px;
  }

  .body.coding {
    grid-template-columns: minmax(0, 1fr) 560px 340px;
  }

  .left {
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
    background: var(--paper-2);
    container-type: size;
  }

  .transport {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-top: 1px solid var(--line);
    font-size: 12px;
    flex-shrink: 0;
  }

  .transport > button,
  .add > button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 7px;
    color: var(--ink);
  }

  .transport button:hover:not(:disabled) {
    background: var(--paper-3);
  }

  .transport button:disabled {
    opacity: 0.35;
  }

  .transport button.on {
    background: var(--paper-3);
    color: #0099ff;
  }

  .tc {
    font-family: 'Fragment Mono', ui-monospace, monospace;
    font-size: 11px;
    padding: 0 6px;
  }

  .sep {
    width: 1px;
    height: 18px;
    background: var(--line);
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
    background: var(--paper);
    border: 1px solid var(--line);
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
    background: var(--paper-3);
  }

  .menu-head {
    padding: 4px 8px 2px;
    font-family: 'Fragment Mono', ui-monospace, monospace;
    font-size: 10px;
    text-transform: uppercase;
    color: var(--ink-soft);
  }


  .notice {
    margin-left: 8px;
    color: var(--ink-soft);
  }

  .tl {
    height: 240px;
    flex-shrink: 0;
  }

  .props {
    border-left: 1px solid var(--line);
    min-height: 0;
    overflow: hidden;
  }

  .hint {
    padding: 16px 12px;
    color: var(--ink-soft);
    font-size: 12px;
  }

  .chat {
    border-left: 1px solid var(--line);
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
      background: var(--paper);
      border-left: 0;
      border-top: 1px solid var(--line);
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
      border-bottom: 1px solid var(--line);
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
      border-top: 1px solid var(--line);
    }

    .tabs button {
      flex: 1;
      font-size: 13px;
      font-weight: 500;
      color: var(--ink-soft);
    }

    .tabs button.on {
      color: var(--ink);
      box-shadow: inset 0 2px 0 var(--ink);
    }
  }
</style>
