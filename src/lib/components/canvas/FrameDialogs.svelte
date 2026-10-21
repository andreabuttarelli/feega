<script lang="ts">
  import { untrack } from 'svelte';
  import ExportDialog from '$lib/components/motion/ExportDialog.svelte';
  import MotionPreview from '$lib/components/motion/MotionPreview.svelte';
  import SoundDialog, { type Made, type SoundKind } from '$lib/components/motion/SoundDialog.svelte';
  import ComponentLibrary from '$lib/components/motion/ComponentLibrary.svelte';
  import TemplateLibrary from '$lib/components/motion/TemplateLibrary.svelte';
  import BranchesMenu from '$lib/components/motion/BranchesMenu.svelte';
  import VarsPanel from '$lib/components/motion/VarsPanel.svelte';
  import InteractivePanel from '$lib/components/motion/InteractivePanel.svelte';
  import FrameChatHistory from '$lib/components/motion/FrameChatHistory.svelte';
  import FrameDialogCard from './FrameDialogCard.svelte';
  import { postPageAction } from '$lib/api/page-action';
  import { AssetSize, canvasAssetUrl } from '$lib/canvas/asset-url';
  import { FrameDialog } from '$lib/canvas/frame-dialogs';
  import type { FrameExtras } from '$lib/canvas/frame-extras.svelte';
  import type { FrameEditSession } from '$lib/motion/frame-edit-session.svelte';
  import type { BrandTokens } from '$lib/motion/brand';
  import { AssetKind } from '$lib/motion/components';
  import { findClip, type MotionDoc, type MotionFormat } from '$lib/motion/doc';
  import { addClip, type OpResult } from '$lib/motion/timeline';
  import { SaveState } from '$lib/motion/editor-bar';
  import { Liveness } from '$lib/motion/interactive/settings';
  import { applyInteractivePreset } from '$lib/motion/interactive/presets';
  import type { VarValues } from '$lib/motion/interactive/vars';
  import { carryEdits, insertTemplate, type Inserted, type Instance, type TemplateEntry } from '$lib/motion/template/library';
  import { BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';
  import { catalogue, starterDoc, starterFormatOf } from '$lib/motion/template/catalogue';
  import { Target, composeHtml } from '$lib/motion/hyperframes/compose';
  import type { ExportRow } from '$lib/motion/export-rows';

  type Branch = { id: string; frameId: string; name: string; baseVersion: number };
  type Conflict = { path: string; branch: unknown; main: unknown };
  type Revision = { version: number; summary: string | null; actorKind: string; createdAt: string; clips: number; name: string | null };
  type ImagesMade = { url: string; name: string; files: string[] };

  const ID_LENGTH = 8;
  const newId = () => crypto.randomUUID().slice(0, ID_LENGTH);
  const SOUND_LABEL: Record<SoundKind, string> = { voice: 'Voice-over', music: 'Music' };
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
    onfocus,
    onimages,
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
    onfocus: (nodeId: string) => void;
    onimages: (rows: ExportRow[]) => Promise<ImagesMade | string>;
    onclose: () => void;
  } = $props();

  const doc = $derived(session.history.present);
  const data = $derived(extras.data);
  const editorUrl = extras.editorUrl;
  const sound = $derived(SOUND_OF[dialog] ?? null);
  const assetUrls = $derived(extras.assetUrls);
  const selected = $derived(session.selection.length === 1 ? (findClip(doc, session.selection[0])?.clip ?? null) : null);

  $effect(() => {
    void extras.load();
  });

  let capture = $state<MotionPreview | null>(null);
  const captureHtml = $derived(composeHtml({ doc, tokens, assets: assetUrls, analyses: extras.analyses, liveness: Liveness.Baked, target: Target.Screen }));

  $effect(() => {
    if (dialog !== FrameDialog.Export) {
      return;
    }
    const ids = [...new Set(untrack(() => doc).tracks.flatMap((t) => t.clips.map((c) => (c.props as { assetId?: string | null }).assetId ?? '')))];
    const sounds = ids.filter((id) => assetUrls[id] && extras.assets.some((a) => a.id === id && (a.kind === AssetKind.Audio || a.kind === AssetKind.Video)));
    void extras.analyse(sounds);
  });

  const renderer: NonNullable<MotionPreview['render']> = (...args) => (capture ? capture.render(...args) : Promise.reject(new Error('the preview is still loading')));

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

  const composeDraft = (d: MotionDoc) => composeHtml({ doc: d, tokens, assets: assetUrls, analyses: extras.analyses, liveness: Liveness.Baked, target: Target.Screen });

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

  const fork = $derived((data?.node as { fork?: Branch | null } | undefined)?.fork ?? null);
  let branches = $state<Branch[]>([]);
  let conflicts = $state<Conflict[] | null>(null);
  let revisions = $state<Revision[]>([]);

  const act = (name: string, form = new FormData()) => postPageAction(editorUrl, name, form);

  async function loadBranches() {
    const result = await act('branches');
    branches = result.type === 'success' ? ((result.data as { branches: Branch[] }).branches ?? []) : [];
  }

  async function createBranch(name: string) {
    await session.save();
    const form = new FormData();
    form.set('name', name);
    const result = await act('createBranch', form);
    if (result.type !== 'success') {
      session.notice = 'The branch could not be created.';
      return;
    }
    await loadBranches();
  }

  async function reviewBranch() {
    await session.save();
    const result = await act('reviewBranch');
    conflicts = result.type === 'success' ? (result.data as { conflicts: Conflict[] }).conflicts : [];
  }

  async function mergeBranch(choices: Record<string, string>) {
    const form = new FormData();
    form.set('choices', JSON.stringify(choices));
    const result = await act('mergeBranch', form);
    if (result.type !== 'success' || !fork) {
      session.notice = 'The branch could not be merged.';
      return;
    }
    onclose();
    onfocus(fork.frameId);
  }

  async function dropBranch() {
    const result = await act('dropBranch');
    if (result.type === 'success' && fork) {
      onclose();
      onfocus(fork.frameId);
    }
  }

  async function loadRevisions() {
    const result = await act('revisions');
    revisions = result.type === 'success' ? ((result.data?.revisions as Revision[]) ?? []) : [];
  }

  async function nameCurrent(name: string) {
    const form = new FormData();
    form.set('version', String(session.version));
    form.set('name', name);
    const result = await act('nameVersion', form);
    session.notice = result.type === 'success' ? '' : 'The version could not be named: reload and try again.';
    await loadRevisions();
  }

  async function restoreTo(target: number) {
    await session.flushScheduled();
    const form = new FormData();
    form.set('version', String(target));
    const result = await act('restore', form);
    if (result.type !== 'success') {
      session.notice = `Version ${target} could not be restored: reload and try again.`;
      return;
    }
    const head = result.data?.head as { version: number; doc: MotionDoc };
    session.adopt(head);
    onedit({ ok: true, doc: head.doc }, `Restored version ${target}`);
    onclose();
  }

  $effect(() => {
    if (dialog === FrameDialog.Branches && !fork) {
      void loadBranches();
    }
    if (dialog === FrameDialog.History) {
      void loadRevisions();
    }
  });
</script>

<div class="layer">
{#if dialog === FrameDialog.Export && data}
  <ExportDialog
    {doc}
    {assetUrls}
    scope={{ orgId: data.orgId, projectId, nodeId }}
    {editorUrl}
    fileName={data.node.name ?? 'motion'}
    render={renderer}
    fallbackRender={renderer}
    {tokens}
    analyses={extras.analyses}
    server={{ ...data.serverRender, version: session.version, saved: session.saveState === SaveState.Saved, assetHref: (id: string) => canvasAssetUrl(projectId, canvasId, id, AssetSize.Full) }}
    images={{ count: 1, onexport: onimages }}
    onpresets={() => onswitch(FrameDialog.Interactive)}
    {onclose}
  />
  <div class="capture" aria-hidden="true">
    <MotionPreview bind:this={capture} html={captureHtml} width={doc.width} height={doc.height} fps={doc.fps} background={doc.background} />
  </div>
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
{:else if dialog === FrameDialog.Branches && data}
  <FrameDialogCard title="Branches" testid="frame-branches" {onclose}>
    <BranchesMenu {fork} {branches} {conflicts} oncreate={(name) => void createBranch(name)} onopen={(id) => (onclose(), onfocus(id))} onreview={() => void reviewBranch()} onmerge={(c) => void mergeBranch(c)} ondrop={() => void dropBranch()} />
  </FrameDialogCard>
{:else if dialog === FrameDialog.History}
  <FrameDialogCard title="Version history" testid="frame-revisions" {onclose}>
    <input class="version-name" aria-label="Name the current version" placeholder="Name the current version" data-testid="version-name" onkeydown={(e) => e.key === 'Enter' && void nameCurrent(e.currentTarget.value)} />
    {#each revisions as r (r.version)}
      <button type="button" class="revision" data-testid="revision" disabled={r.version === session.version} onclick={() => void restoreTo(r.version)}>
        <span>{r.name ? `${r.name} · v${r.version}` : `v${r.version}`} · {r.actorKind === 'agent' ? 'Agent' : 'You'} · {r.clips} clips</span>
        <kbd>{r.version === session.version ? 'Current' : 'Restore'}</kbd>
      </button>
    {:else}
      <span class="empty">No saved versions yet</span>
    {/each}
  </FrameDialogCard>
{:else if dialog === FrameDialog.Chat}
  <FrameDialogCard title="Chat history" testid="frame-chat" {onclose}>
    <FrameChatHistory historyUrl={`/api/v1/projects/${projectId}/motion/${nodeId}/agent`} {projectId} open />
  </FrameDialogCard>
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

  .version-name {
    font: inherit;
    padding: 6px 8px;
    border: 1px solid var(--ui-divider);
    background: transparent;
    color: inherit;
  }

  .revision {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--ui-row);
    padding: 0 8px;
    text-align: left;
    border-radius: var(--ui-radius-sm);
    color: var(--ui-text);
  }

  .revision:hover:not(:disabled) {
    background: var(--ui-wash);
  }

  .revision kbd {
    margin-left: auto;
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    color: var(--ui-text-3);
  }

  .empty {
    opacity: 0.6;
  }
</style>
