<script lang="ts">
  import MotionInspector from '$lib/components/motion/MotionInspector.svelte';
  import MultiInspector from '$lib/components/motion/MultiInspector.svelte';
  import LookInspector from '$lib/components/motion/LookInspector.svelte';
  import TemplateInspector from '$lib/components/motion/TemplateInspector.svelte';
  import DevInspector from '$lib/components/canvas/DevInspector.svelte';
  import { frameProperties } from './frame-properties.svelte';
  import HeaderActions from '$lib/components/motion/HeaderActions.svelte';
  import ClipBar from '$lib/components/motion/ClipBar.svelte';
  import InstanceInspector from '$lib/components/motion/InstanceInspector.svelte';
  import RangeTextInspector from '$lib/components/motion/RangeTextInspector.svelte';
  import PrototypeSection from '$lib/components/motion/PrototypeSection.svelte';
  import VariablesLibrarySection from '$lib/components/motion/VariablesLibrarySection.svelte';
  import StyleLibrarySection from '$lib/components/motion/StyleLibrarySection.svelte';
  import { textRange } from '$lib/canvas/text-range.svelte';
  import CameraInspector from '$lib/components/motion/CameraInspector.svelte';
  import DevicePresets from '$lib/components/motion/DevicePresets.svelte';
  import ParticlePresets from '$lib/components/motion/ParticlePresets.svelte';
  import PosterPartPanel from '$lib/components/motion/PosterPartPanel.svelte';
  import DocFields from '$lib/components/motion/DocFields.svelte';
  import ScenesSection from '$lib/components/motion/ScenesSection.svelte';
  import FramePresetSection from '$lib/components/motion/FramePresetSection.svelte';
  import LayoutGuidesSection from '$lib/components/motion/LayoutGuidesSection.svelte';
  import type { FrameEditSession } from '$lib/motion/frame-edit-session.svelte';
  import type { BrandTokens } from '@feega/motion-core/motion/brand';
  import type { ComponentProps } from 'svelte';
  import { THREE_D_COMPONENTS } from '@feega/motion-core/motion/components';
  import { PickMode } from '$lib/motion/clip-bar';
  import { PropertiesView } from '$lib/motion/properties-view';
  import { barActionLater, frameBarActions, inspectorOf } from '$lib/canvas/frame-inspector';
  import { loadOutliner } from '$lib/motion/fonts/outliner';
  import type { ActionId } from '$lib/motion/actions';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import { mergeScope, scopeView } from '$lib/motion/instance-view';

  const FIRST_FRAME = 0;

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

  const doc = $derived(session?.history.present ?? null);
  const shown = $derived(session && doc ? inspectorOf(doc, session.selection) : null);
  const edit = (next: NonNullable<typeof doc>, summary: string) => session?.edit(next, summary);
  const shownDoc = $derived(doc && shown ? scopeView(doc, shown) : doc);
  const editShown = (next: NonNullable<typeof doc>, summary: string) => doc && shown && edit(mergeScope(doc, shown, next), summary);
  const commitShown = (result: OpResult, summary: string) => result.ok && editShown(result.doc, summary);
  const editGuides = (result: OpResult, summary: string) => result.ok && edit(result.doc, summary);

  async function runBar(id: ActionId) {
    if (!session || !doc) {
      return;
    }
    const done = await barActionLater(id, { doc, selection: session.selection, frame: FIRST_FRAME, newId: () => crypto.randomUUID().slice(0, 8), load: loadOutliner, assets: {} });
    if (!done) {
      return;
    }
    session.edit(done.doc, done.summary);
    session.select(done.selection);
  }
</script>

{#snippet devToggle(label: string)}<button type="button" class="dev-toggle" title="⇧D" onclick={() => frameProperties.toggleDev?.()} data-testid="dev-toggle">{label}</button>{/snippet}
{#snippet headerBar()}{#if session && doc}<HeaderActions {doc} selection={session.selection} extra={frameBarActions(doc, session.selection)} onrun={(id) => void runBar(id)} />{/if}{/snippet}

{#snippet partLead()}{#if part && shown?.clip && doc && tokens}<PosterPartPanel gesture={session?.live} doc={shownDoc!} clip={shown.clip} {part} {assets} {upload} {tokens} onchange={editShown} />{/if}{/snippet}

{#if frameProperties.dev && session && doc}
  <aside class="frame-inspector" data-testid="frame-inspector" aria-label="Dev mode">
    {@render devToggle('Exit dev mode')}
    {#if shown?.clip}
      <DevInspector doc={shownDoc!} clipId={shown.clip.id} brand={tokens} onexport={frameProperties.exportPicks} />
    {:else}
      <p class="empty" data-testid="dev-empty">Select one layer to read its CSS.</p>
    {/if}
  </aside>
{:else if session && doc && tokens && !session.selection.length}
  <aside class="frame-inspector" data-testid="frame-inspector" aria-label="Properties">
    {@render devToggle('Dev mode')}
    <DocFields gesture={session.live} {doc} {assets} {upload} onchange={edit} />
    <ScenesSection {doc} onchange={editGuides} />
    <FramePresetSection {doc} onchange={editGuides} />
    <CameraInspector {doc} frame={FIRST_FRAME} onchange={edit} />
    <LayoutGuidesSection {doc} onchange={editGuides} />
    <StyleLibrarySection {tokens} />
    <VariablesLibrarySection {doc} onchange={editGuides} />
  </aside>
{:else if session && doc && tokens && shown}
  <aside class="frame-inspector" data-testid="frame-inspector" aria-label="Properties">
    {@render devToggle('Dev mode')}
    {#if shown.view === PropertiesView.Multiple}
      <ClipBar {doc} selection={session.selection} pick={PickMode.One} extra={frameBarActions(doc, session.selection)} onrun={(id) => void runBar(id)} ondone={() => {}} />
      <MultiInspector {doc} ids={session.selection} frame={session.playhead} mode={session.mode} onchange={edit} />
    {:else if shown.view === PropertiesView.Template}
      <TemplateInspector actions={headerBar} gesture={session.live} {doc} clip={shown.clip} {assets} {upload} onchange={edit} />
    {:else}
      {@const Presets = CLIP_PRESETS[shown.clip.component]}
      <InstanceInspector doc={shownDoc!} clipId={shown.clip.id} onchange={editShown} onrun={(id) => void runBar(id)} />
      {#if textRange.clipId === shown.clip.id}<RangeTextInspector {doc} {tokens} {fonts} onchange={edit} />{/if}
      <MotionInspector gesture={session.live} lead={partLead} actions={headerBar} doc={shownDoc!} clip={shown.clip} {tokens} {assets} {fonts} {upload} {analyses} frame={session.playhead} mode={session.mode} onchange={editShown} />
      <PrototypeSection doc={shownDoc!} clip={shown.clip} commit={commitShown} />
      {#if Presets}<Presets doc={shownDoc!} clip={shown.clip} onchange={editShown} />{/if}
      {#if THREE_D_COMPONENTS.includes(shown.clip.component)}<LookInspector gesture={session.live} {doc} onchange={edit} />{/if}
    {/if}
  </aside>
{:else}
  <p class="empty" data-testid="properties-empty">Select an element in a frame to edit its properties.</p>
{/if}

<style>
  .frame-inspector {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .dev-toggle {
    align-self: flex-end;
    margin: var(--ui-space-2) var(--ui-space-4) 0;
    padding: var(--ui-space-1) var(--ui-space-3);
    font: inherit;
    font-size: var(--ui-type-caption);
    color: var(--ui-text);
    background: var(--ui-input);
    border: 0;
    border-radius: var(--ui-radius-sm);
    cursor: pointer;
  }

  .dev-toggle:hover {
    background: var(--ui-input-hover);
  }

  .empty {
    margin: 0;
    padding: var(--ui-space-4);
    color: var(--ui-text-secondary);
    font-size: var(--ui-type-caption);
  }
</style>
