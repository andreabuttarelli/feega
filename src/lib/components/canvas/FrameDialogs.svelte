<script lang="ts">
  import { untrack } from 'svelte';
  import ExportDialog from '$lib/components/motion/ExportDialog.svelte';
  import MotionPreview from '$lib/components/motion/MotionPreview.svelte';
  import { RenderEngine } from '$lib/motion/gpu/engine-flag';
  import SoundDialog, { type Made, type SoundKind } from '$lib/components/motion/SoundDialog.svelte';
  import ComponentLibrary from '$lib/components/motion/ComponentLibrary.svelte';
  import TemplateLibrary from '$lib/components/motion/TemplateLibrary.svelte';
  import VarsPanel from '$lib/components/motion/VarsPanel.svelte';
  import InteractivePanel from '$lib/components/motion/InteractivePanel.svelte';
  import FrameChatHistory from '$lib/components/motion/FrameChatHistory.svelte';
  import StillExport from '$lib/components/motion/StillExport.svelte';
  import TemplateDialog from '$lib/components/motion/TemplateDialog.svelte';
  import PublishDialog, { type Listed } from '$lib/components/gallery/PublishDialog.svelte';
  import FrameDialogCard from './FrameDialogCard.svelte';
  import { CardWidth } from './frame-dialog-card';
  import { postPageAction } from '$lib/api/page-action';
  import { AssetSize, canvasAssetUrl } from '$lib/canvas/asset-url';
  import { FrameDialog } from '$lib/canvas/frame-dialogs';
  import type { FrameExtras } from '$lib/canvas/frame-extras.svelte';
  import type { FrameEditSession } from '$lib/motion/frame-edit-session.svelte';
  import type { BrandTokens } from '@feega/motion-core/motion/brand';
  import { AssetKind } from '@feega/motion-core/motion/components';
  import { DocMode, docMode, findClip, type MotionDoc, type MotionFormat } from '@feega/motion-core/motion/doc';
  import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
  import { SaveState } from '$lib/motion/editor-bar';
  import { Liveness } from '@feega/motion-core/motion/interactive/settings';
  import { applyInteractivePreset } from '$lib/motion/interactive/presets';
  import type { VarValues } from '@feega/motion-core/motion/interactive/vars';
  import { carryEdits, insertTemplate, type Inserted, type Instance, type TemplateEntry } from '$lib/motion/template/library';
  import { BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';
  import { catalogue, starterDoc, starterFormatOf } from '$lib/motion/template/catalogue';
  import { Target, composeHtml } from '@feega/motion-core/motion/hyperframes/compose';
  import type { ExportRow } from '$lib/motion/export-rows';
  import type { FrameSource } from '$lib/motion/export/browser-render';
  import { loadScenes, type LoadedScenes } from '$lib/canvas/scene-sources';
  import { resolveScenes, sceneNodeIds } from '$lib/motion/scenes';

  type ImagesMade = { url: string; name: string; files: string[] };

  const ID_LENGTH = 8;
  const newId = () => crypto.randomUUID().slice(0, ID_LENGTH);
  const SOUND_LABEL: Record<SoundKind, string> = { voice: 'Voice-over', music: 'Music' };
  const CAPTURING: ReadonlySet<FrameDialog> = new Set([FrameDialog.Export, FrameDialog.SaveTemplate]);
  const SOUND_OF: Partial<Record<FrameDialog, SoundKind>> = { [FrameDialog.Voice]: 'voice', [FrameDialog.Music]: 'music' };

  let {
    dialog,
    nodeId,
    projectId,
    canvasId,
    session,
    extras,
    tokens,
    frame,
    onedit,
    onswitch,
    onimages,
    onpreview,
    onclose
  }: {
    dialog: FrameDialog;
    nodeId: string;
    projectId: string;
    canvasId: string;
    session: FrameEditSession;
    extras: FrameExtras;
    tokens: BrandTokens;
    frame: number;
    onedit: (result: OpResult, summary: string) => void;
    onswitch: (next: FrameDialog) => void;
    onimages: (rows: ExportRow[]) => Promise<ImagesMade | string>;
    onpreview: (doc: MotionDoc | null) => void;
    onclose: () => void;
  } = $props();

  const doc = $derived(session.history.present);
  const data = $derived(extras.data);
  const editorUrl = extras.editorUrl;
  const sound = $derived(SOUND_OF[dialog] ?? null);
  let scenes = $state<LoadedScenes & { key: string }>({ docs: {}, assets: {}, key: '' });
  const sceneKey = $derived(sceneNodeIds(doc).join(','));
  const scenesReady = $derived(scenes.key === sceneKey);
  $effect(() => {
    if (!sceneKey) {
      return;
    }
    const sourceOf = async (id: string) => {
      const res = await fetch(`/p/${projectId}/c/${canvasId}/motion/${id}/source`);
      return res.ok ? await res.json() : null;
    };
    const key = sceneKey;
    void loadScenes(untrack(() => doc), sourceOf).then((loaded) => (scenes = { ...loaded, key }));
  });
  const assetUrls = $derived({ ...scenes.assets, ...extras.assetUrls });
  const played = (d: MotionDoc) => resolveScenes(d, scenes.docs);
  const selected = $derived(session.selection.length === 1 ? (findClip(doc, session.selection[0])?.clip ?? null) : null);

  $effect(() => {
    void extras.load();
  });

  let capture = $state<MotionPreview | null>(null);
  const captureHtml = $derived(composeHtml({ doc: played(doc), tokens, assets: assetUrls, analyses: extras.analyses, liveness: Liveness.Baked, target: Target.Screen }));

  $effect(() => {
    if (dialog !== FrameDialog.Export) {
      return;
    }
    const ids = [...new Set(untrack(() => doc).tracks.flatMap((t) => t.clips.map((c) => (c.props as { assetId?: string | null }).assetId ?? '')))];
    const sounds = ids.filter((id) => assetUrls[id] && extras.assets.some((a) => a.id === id && (a.kind === AssetKind.Audio || a.kind === AssetKind.Video)));
    void extras.analyse(sounds);
  });

  const renderer: NonNullable<MotionPreview['render']> = (...args) => (capture ? capture.render(...args) : Promise.reject(new Error('the preview is still loading')));

  const sceneOf = (d: MotionDoc) => ({ doc: played(d), tokens, assets: assetUrls, analyses: extras.analyses, compose: (only?: ReadonlySet<string>) => composeOnly(d, only) });

  const framesFor = (d: MotionDoc): FrameSource => (times, size, onFrame, signal) => renderer(times, size, onFrame, signal, composeDraft(d), undefined, RenderEngine.GpuCore, sceneOf(d));

  const assetHref = (id: string) => canvasAssetUrl(projectId, canvasId, id, AssetSize.Full);

  let relisted = $state<{ item: Listed | null } | null>(null);
  const listed = $derived(relisted ? relisted.item : (data?.gallery.listed ?? null));

  let templates = $state<TemplateEntry[]>([]);
  $effect(() => {
    if (data) {
      templates = [...BUILTIN_TEMPLATES, ...data.templates];
    }
  });
  const components = $derived(catalogue(templates));

  function componentDraft(id: string, format: MotionFormat): Instance | null {
    const entry = templates.find((t) => t.id === id);
    const made = entry ? starterDoc(entry, format, newId) : null;
    return made?.ok ? { doc: made.doc, clipId: made.clipId } : null;
  }

  const composeOnly = (d: MotionDoc, only?: ReadonlySet<string>) => composeHtml({ doc: played(d), tokens, assets: assetUrls, analyses: extras.analyses, liveness: Liveness.Baked, target: Target.Screen, only });

  const composeDraft = (d: MotionDoc) => composeOnly(d);

  function placedWith(entry: TemplateEntry, draft: Instance | null): Inserted {
    const placed = insertTemplate(doc, entry, { from: frame, newId });
    if (!placed.ok || !draft) {
      return placed;
    }
    const carried = carryEdits(draft, placed);
    return carried.ok ? { ...placed, doc: carried.doc } : carried;
  }

  async function addTemplateSounds(withTemplate: MotionDoc, clipId: string, at: MotionDoc) {
    const form = new FormData();
    form.set('doc', JSON.stringify(withTemplate));
    form.set('clipId', clipId);
    const result = await postPageAction(editorUrl, 'templateSounds', form);
    if (result.type !== 'success') {
      session.notice = 'The template is in; its sounds could not be added.';
      return;
    }
    if (session.history.present !== at) {
      session.notice = 'The video changed while its sounds were made: insert the template again to add them.';
      return;
    }
    onedit({ ok: true, doc: (result.data as { doc: MotionDoc }).doc }, 'Added template sounds');
  }

  async function insertEntry(entry: TemplateEntry, sounds: boolean, draft: Instance | null = null) {
    onclose();
    const placed = placedWith(entry, draft);
    onedit(placed, `Inserted ${entry.template.name}`);
    if (placed.ok && sounds) {
      await addTemplateSounds(placed.doc, placed.clipId, session.history.present);
    }
  }

  function insertComponent(id: string, sounds: boolean, draft: Instance | null) {
    const entry = templates.find((t) => t.id === id);
    if (entry) {
      void insertEntry(entry, sounds, draft);
    }
  }

  function placeSound(kind: SoundKind, made: Made) {
    extras.addAsset({ id: made.assetId, kind: AssetKind.Audio, label: `${SOUND_LABEL[kind]} · ${made.assetId.slice(0, 6)}`, previewUrl: '', url: made.url, seconds: made.seconds } as never);
    const durationInFrames = Math.max(doc.fps, Math.ceil(made.seconds * doc.fps));
    onedit(addClip(doc, { component: 'Audio', from: frame, durationInFrames, props: { assetId: made.assetId } }, newId()), `Added ${SOUND_LABEL[kind].toLowerCase()}`);
    onclose();
  }

  let previewVars = $state<VarValues>({});
</script>

<div class="layer">
{#if dialog === FrameDialog.Export && data && docMode(doc) === DocMode.Still}
  <StillExport {doc} {editorUrl} fileName={data.node.name ?? 'still'} saved={session.saveState === SaveState.Saved} {onclose} />
{:else if dialog === FrameDialog.Export && data && scenesReady}
  <ExportDialog
    doc={played(doc)}
    {assetUrls}
    scope={{ orgId: data.orgId, projectId, nodeId }}
    {editorUrl}
    fileName={data.node.name ?? 'motion'}
    render={framesFor(doc)}
    fallbackRender={renderer}
    {tokens}
    analyses={extras.analyses}
    server={{ ...data.serverRender, version: session.version, saved: session.saveState === SaveState.Saved, assetHref }}
    images={{ count: 1, onexport: onimages }}
    onpresets={() => onswitch(FrameDialog.Interactive)}
    {onclose}
  />
{:else if dialog === FrameDialog.SaveTemplate && data}
  <TemplateDialog
    {doc}
    clip={selected}
    {editorUrl}
    version={session.version}
    saved={session.saveState === SaveState.Saved}
    batch={data.batch}
    {assetHref}
    {assetUrls}
    scope={{ orgId: data.orgId, projectId, nodeId }}
    {framesFor}
    onchange={onedit}
    {onpreview}
    {onclose}
  />
{:else if dialog === FrameDialog.Publish && data}
  <PublishDialog
    actionUrl={editorUrl}
    {doc}
    assets={assetUrls}
    {tokens}
    name={data.node.name ?? ''}
    {listed}
    saved={session.saveState === SaveState.Saved}
    onlisted={(item) => (relisted = { item })}
    {onclose}
  />
{:else if sound}
  <SoundDialog kind={sound} {editorUrl} seconds={doc.durationInFrames / doc.fps} {onclose} onmade={(made) => placeSound(sound, made)} />
{:else if dialog === FrameDialog.Components && data}
  <ComponentLibrary items={components} format={starterFormatOf(doc)} draftOf={componentDraft} compose={composeDraft} assets={extras.assets} upload={extras.uploadMedia} onpick={insertComponent} {onclose} />
{:else if dialog === FrameDialog.Templates && data}
  <TemplateLibrary
    {templates}
    {doc}
    selectedComp={selected?.component === 'Precomp' ? String(selected.props.comp) : null}
    {frame}
    {editorUrl}
    compose={composeDraft}
    oninsert={insertEntry}
    onsaved={(entry) => ((templates = [...templates, entry]), (session.notice = `Saved ${entry.template.name} to the templates.`))}
    onremoved={(id) => (templates = templates.filter((t) => t.id !== id))}
    {onclose}
  />
{:else if dialog === FrameDialog.Interactive}
  <FrameDialogCard title="Interactive" testid="frame-interactive" {onclose}>
    <div class="panels">
    <InteractivePanel active tilt={false} clipId={selected?.id ?? null} onpreset={(preset) => onedit(applyInteractivePreset(doc, preset, selected?.id ?? null), preset)} />
    <VarsPanel {doc} bind:values={previewVars} clip={selected} onchange={(next, summary) => onedit({ ok: true, doc: next }, summary)} />
    </div>
  </FrameDialogCard>
{:else if dialog === FrameDialog.Chat}
  <FrameDialogCard title="Chat history" testid="frame-chat" {onclose}>
    <FrameChatHistory historyUrl={`/api/v1/projects/${projectId}/motion/${nodeId}/agent`} {projectId} open />
  </FrameDialogCard>
{/if}
{#if CAPTURING.has(dialog)}
  <div class="capture" aria-hidden="true">
    <MotionPreview bind:this={capture} html={captureHtml} width={doc.width} height={doc.height} fps={doc.fps} background={doc.background} engine={RenderEngine.Html} />
  </div>
{/if}
</div>

<style>
  .layer {
    position: fixed;
    inset: 0;
    z-index: 200;
    pointer-events: none;
  }

  .layer > :global(*) {
    pointer-events: auto;
  }

  .capture {
    position: fixed;
    left: 0;
    top: 0;
    width: 960px;
    height: 540px;
    container-type: size;
    pointer-events: none;
    opacity: 0;
    z-index: -1;
  }

  .panels {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .panels :global(button),
  .panels :global(input[type='text']),
  .panels :global(input[type='number']),
  .panels :global(select) {
    font: inherit;
    padding: 4px 8px;
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: inherit;
  }

  .panels :global(.row),
  .panels :global(.var) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

</style>
