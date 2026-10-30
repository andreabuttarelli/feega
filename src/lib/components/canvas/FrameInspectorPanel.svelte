<script lang="ts">
  import MotionInspector from '$lib/components/motion/MotionInspector.svelte';
  import MultiInspector from '$lib/components/motion/MultiInspector.svelte';
  import LookInspector from '$lib/components/motion/LookInspector.svelte';
  import TemplateInspector from '$lib/components/motion/TemplateInspector.svelte';
  import DevInspector from '$lib/components/canvas/DevInspector.svelte';
  import DevCode from '$lib/components/canvas/DevCode.svelte';
  import { frameProperties } from './frame-properties.svelte';
  import HeaderActions from '$lib/components/motion/HeaderActions.svelte';
  import ClipBar from '$lib/components/motion/ClipBar.svelte';
  import InstanceInspector from '$lib/components/motion/InstanceInspector.svelte';
  import RangeTextInspector from '$lib/components/motion/RangeTextInspector.svelte';
  import PrototypeSection from '$lib/components/motion/PrototypeSection.svelte';
  import StatesSection from '$lib/components/motion/StatesSection.svelte';
  import { statePreview } from '$lib/canvas/state-preview.svelte';
  import FlowSection from '$lib/components/motion/FlowSection.svelte';
  import VariablesLibrarySection from '$lib/components/motion/VariablesLibrarySection.svelte';
  import StyleLibrarySection from '$lib/components/motion/StyleLibrarySection.svelte';
  import { textRange } from '$lib/canvas/text-range.svelte';
  import CameraInspector from '$lib/components/motion/CameraInspector.svelte';
  import DevicePresets from '$lib/components/motion/DevicePresets.svelte';
  import ParticlePresets from '$lib/components/motion/ParticlePresets.svelte';
  import PosterPartPanel from '$lib/components/motion/PosterPartPanel.svelte';
  import DocFields from '$lib/components/motion/DocFields.svelte';
  import ScenesSection from '$lib/components/motion/ScenesSection.svelte';
  import FrameColoursSection from '$lib/components/motion/FrameColoursSection.svelte';
  import FramePresetSection from '$lib/components/motion/FramePresetSection.svelte';
  import LayoutGuidesSection from '$lib/components/motion/LayoutGuidesSection.svelte';
  import type { FrameEditSession } from '$lib/motion/frame-edit-session.svelte';
  import { FEEGA_TOKENS, type BrandTokens } from '@feega/motion-core/motion/brand';
  import type { ComponentProps } from 'svelte';
  import { THREE_D_COMPONENTS } from '@feega/motion-core/motion/components';
  import { PickMode } from '$lib/motion/clip-bar';
  import { PropertiesView } from '$lib/motion/properties-view';
  import { barActionLater, frameBarActions, inspectorOf } from '$lib/canvas/frame-inspector';
  import { letteringOf } from '$lib/motion/text-outline-run';
  import type { ActionId } from '$lib/motion/actions';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import { mergeScope, scopeView } from '$lib/motion/instance-view';
  import { inView, liftEdit } from '@feega/motion-core/motion/breakpoints/model';
  import BreakpointsSection from '$lib/components/motion/BreakpointsSection.svelte';
  import BreakpointOverrides from '$lib/components/motion/BreakpointOverrides.svelte';
  import { ModeInspector, SoundEntries, editorMode } from '$lib/canvas/editor-mode.svelte';
  import SoundSection from './SoundSection.svelte';
  import PlayInspector from './PlayInspector.svelte';
  import NodeInspector from './NodeInspector.svelte';
  import { FRAME_PANEL_ACTIONS } from '$lib/canvas/selection-actions';
  import { SELECTION_ACTION_ICON } from '$lib/canvas/selection-action-icons';
  import { selectionProperties } from './selection-properties.svelte';
  import AlignBar from '$lib/components/motion/AlignBar.svelte';
  import { frameSurface, withSurface } from '@feega/motion-core/motion/surface';
  import { EditMode } from '$lib/motion/edit-mode';
  import { alignSpace, distributeSpace, propBoxes, type Axis, type Edge } from '$lib/motion/space';

  const FIRST_FRAME = 0;
  const SURFACE_ID = 'frame-surface';

  let {
    session,
    tokens,
    assets = [],
    fonts = null,
    upload = null,
    analyses = {},
    part = null
  }: {
    session: FrameEditSession | null;
    tokens: BrandTokens | null;
    assets?: ComponentProps<typeof MotionInspector>['assets'];
    fonts?: ComponentProps<typeof MotionInspector>['fonts'];
    upload?: ComponentProps<typeof MotionInspector>['upload'];
    analyses?: ComponentProps<typeof MotionInspector>['analyses'];
    part?: string | null;
  } = $props();

  const CLIP_PRESETS: Record<string, typeof DevicePresets | typeof ParticlePresets> = { Device3D: DevicePresets, Particles: ParticlePresets };

  const source = $derived(session?.history.present ?? null);
  const doc = $derived(source && session ? inView(source, session.breakpoint) : source);
  const surfaced = $derived(doc ? withSurface(doc, SURFACE_ID) : null);
  const surface = $derived(surfaced ? frameSurface(surfaced) : null);
  const shown = $derived(session && doc ? inspectorOf(doc, session.selection) : null);
  const edit = (next: NonNullable<typeof doc>, summary: string) => session && source && session.edit(liftEdit(source, session.breakpoint, next), summary);
  const editSource = (result: OpResult, summary: string) => session?.apply(result, summary);
  const pickView = (breakpointId: string) => session && (session.breakpoint = breakpointId);
  const shownDoc = $derived(doc && shown ? scopeView(doc, shown) : doc);
  const editShown = (next: NonNullable<typeof doc>, summary: string) => doc && shown && edit(mergeScope(doc, shown, next), summary);
  const commitShown = (result: OpResult, summary: string) => result.ok && editShown(result.doc, summary);
  const editGuides = (result: OpResult, summary: string) => result.ok && edit(result.doc, summary);

  const alignPicks = (edge: Edge) => doc && session && editGuides(alignSpace(doc, session.selection, session.playhead, propBoxes(doc), edge, session.mode), `Aligned ${edge}`);
  const distributePicks = (axis: Axis, spacing?: number) => doc && session && editGuides(distributeSpace(doc, session.selection, session.playhead, propBoxes(doc), axis, session.mode, spacing), `Distributed along ${axis}`);

  async function runBar(id: ActionId) {
    if (!session || !doc) {
      return;
    }
    const done = await barActionLater(id, { doc, selection: session.selection, frame: FIRST_FRAME, newId: () => crypto.randomUUID().slice(0, 8), load: letteringOf(tokens ?? FEEGA_TOKENS, frameProperties.extras?.assetUrls ?? {}) });
    if (!done) {
      return;
    }
    edit(done.doc, done.summary);
    session.select(done.selection);
  }
</script>

{#snippet headerBar()}{#if session && doc}<HeaderActions {doc} selection={session.selection} extra={frameBarActions(doc, session.selection)} onrun={(id) => void runBar(id)} />{/if}{/snippet}

{#snippet partLead()}{#if part && shown?.clip && doc && tokens}<PosterPartPanel gesture={session?.live} doc={shownDoc!} clip={shown.clip} {part} {assets} {upload} {tokens} onchange={editShown} />{/if}{/snippet}

{#if editorMode.spec.inspector === ModeInspector.Play && session && doc}
  <PlayInspector doc={shownDoc!} clip={shown?.clip ?? null} commit={commitShown} />
{:else if editorMode.spec.inspector === ModeInspector.Code && session && doc}
  <aside class="frame-inspector" data-testid="frame-inspector" aria-label="Code mode">
    {#if shown?.clip}
      <DevInspector doc={shownDoc!} clipId={shown.clip.id} brand={tokens} onexport={frameProperties.exportPicks} />
    {/if}
    {#if tokens}
      <DevCode {doc} name={frameProperties.name} assets={frameProperties.extras?.assetUrls ?? {}} {tokens} />
    {:else if !shown?.clip}
      <p class="empty" data-testid="dev-empty">Select one layer to read its CSS.</p>
    {/if}
  </aside>
{:else if session && doc && tokens && !session.selection.length}
  <aside class="frame-inspector" data-testid="frame-inspector" data-mode-chrome={editorMode.spec.chrome} aria-label="Properties">
    {#if editorMode.spec.sounds === SoundEntries.Shown && frameProperties.runAction}<SoundSection onrun={frameProperties.runAction} />{/if}
    <FramePresetSection {doc} onchange={editGuides} />
    {#if surfaced && surface}
      <div class="frame-look" data-testid="frame-look">
        <MotionInspector as={PropertiesView.Frame} gesture={session.live} doc={surfaced} clip={surface} {tokens} {assets} {fonts} {upload} frame={session.playhead} mode={EditMode.Design} onchange={edit} />
      </div>
    {/if}
    <LayoutGuidesSection {doc} onchange={editGuides} />
    <details class="frame-settings" data-testid="frame-settings">
      <summary>Frame settings</summary>
      <DocFields gesture={session.live} {doc} {assets} {upload} onchange={edit} />
      <ScenesSection {doc} onchange={editGuides} />
      <FrameColoursSection {doc} onchange={editGuides} />
      <CameraInspector {doc} frame={FIRST_FRAME} onchange={edit} />
      <BreakpointsSection doc={source!} active={session.breakpoint} onchange={editSource} onpick={pickView} />
      <FlowSection {doc} onchange={editGuides} />
      <StyleLibrarySection {tokens} />
      <VariablesLibrarySection {doc} onchange={editGuides} />
    </details>
    {#if frameProperties.runAction}
      {@const run = frameProperties.runAction}
      <section class="frame-actions" aria-label="Frame actions" data-testid="frame-actions">
        {#each FRAME_PANEL_ACTIONS as action (action.id)}
          {@const Icon = SELECTION_ACTION_ICON[action.id]}
          <button type="button" data-testid={`frame-action-${action.id}`} onclick={() => run(action.id)}><Icon size={14} />{action.label}</button>
        {/each}
      </section>
    {/if}
  </aside>
{:else if session && doc && tokens && shown}
  <aside class="frame-inspector" data-testid="frame-inspector" data-mode-chrome={editorMode.spec.chrome} aria-label="Properties">
    {#if shown.view === PropertiesView.Multiple}
      <ClipBar {doc} selection={session.selection} pick={PickMode.One} extra={frameBarActions(doc, session.selection)} onrun={(id) => void runBar(id)} ondone={() => {}} />
      <AlignBar count={session.selection.length} onalign={alignPicks} ondistribute={distributePicks} />
      <MultiInspector gesture={session.live} {doc} ids={session.selection} frame={session.playhead} mode={session.mode} onchange={edit} />
    {:else if shown.view === PropertiesView.Template}
      <TemplateInspector actions={headerBar} gesture={session.live} {doc} clip={shown.clip} {assets} {upload} onchange={edit} />
    {:else}
      {@const Presets = CLIP_PRESETS[shown.clip.component]}
      <BreakpointOverrides doc={source!} clipId={shown.clip.id} active={session.breakpoint} onchange={editSource} />
      <InstanceInspector doc={shownDoc!} clipId={shown.clip.id} onchange={editShown} onrun={(id) => void runBar(id)} />
      {#if textRange.clipId === shown.clip.id}<RangeTextInspector {doc} {tokens} {fonts} onchange={edit} />{/if}
      <MotionInspector gesture={session.live} lead={partLead} actions={headerBar} doc={shownDoc!} clip={shown.clip} {tokens} {assets} {fonts} {upload} {analyses} frame={session.playhead} mode={session.mode} onchange={editShown} />
      {#if frameProperties.nodeId}
        {@const nodeId = frameProperties.nodeId}
        <StatesSection doc={shownDoc!} clip={shown.clip} current={statePreview.stateOf(nodeId, shown.clip.id)} commit={commitShown} onpreview={(next) => statePreview.pick(nodeId, shown.clip.id, next)} />
      {/if}
      <PrototypeSection doc={shownDoc!} clip={shown.clip} commit={commitShown} />
      {#if Presets}<Presets doc={shownDoc!} clip={shown.clip} onchange={editShown} />{/if}
      {#if THREE_D_COMPONENTS.includes(shown.clip.component)}<LookInspector gesture={session.live} {doc} onchange={edit} />{/if}
    {/if}
  </aside>
{:else if !session && selectionProperties.panel}
  <NodeInspector panel={selectionProperties.panel} />
{:else}
  <p class="empty" data-testid="properties-empty">Select an element in a frame to edit its properties.</p>
{/if}

<style>
  .frame-inspector[data-mode-chrome='recording'] {
    box-shadow: inset 2px 0 0 var(--ui-recording);
  }

  .frame-inspector {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .frame-settings > summary {
    display: flex;
    align-items: center;
    height: 36px;
    padding: 0 var(--ui-space-3);
    font-size: var(--ui-type-caption);
    font-weight: 600;
    cursor: pointer;
    border-bottom: 1px solid var(--ui-line);
  }

  .frame-actions {
    display: flex;
    flex-direction: column;
    padding: var(--ui-space-2) var(--ui-space-3);
  }

  .frame-actions button {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    min-height: 32px;
    padding: 0 var(--ui-space-2);
    border-radius: var(--ui-radius-sm);
    font-size: var(--ui-type-caption);
    color: var(--ui-text);
  }

  .frame-actions button:hover {
    background: var(--ui-wash);
  }

  .empty {
    margin: 0;
    padding: var(--ui-space-4);
    color: var(--ui-text-secondary);
    font-size: var(--ui-type-caption);
  }
</style>
