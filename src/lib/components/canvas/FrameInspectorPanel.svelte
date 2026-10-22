<script lang="ts">
  import MotionInspector from '$lib/components/motion/MotionInspector.svelte';
  import MultiInspector from '$lib/components/motion/MultiInspector.svelte';
  import LookInspector from '$lib/components/motion/LookInspector.svelte';
  import ClipBar from '$lib/components/motion/ClipBar.svelte';
  import CameraInspector from '$lib/components/motion/CameraInspector.svelte';
  import DevicePresets from '$lib/components/motion/DevicePresets.svelte';
  import ParticlePresets from '$lib/components/motion/ParticlePresets.svelte';
  import PosterPartPanel from '$lib/components/motion/PosterPartPanel.svelte';
  import DocFields from '$lib/components/motion/DocFields.svelte';
  import LayoutGuidesSection from '$lib/components/motion/LayoutGuidesSection.svelte';
  import type { FrameEditSession } from '$lib/motion/frame-edit-session.svelte';
  import type { BrandTokens } from '$lib/motion/brand';
  import type { ComponentProps } from 'svelte';
  import { THREE_D_COMPONENTS } from '$lib/motion/components';
  import { PickMode } from '$lib/motion/clip-bar';
  import { PropertiesView } from '$lib/motion/properties-view';
  import { barAction, inspectorOf } from '$lib/canvas/frame-inspector';
  import type { ActionId } from '$lib/motion/actions';
  import type { OpResult } from '$lib/motion/timeline';

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
  const editGuides = (result: OpResult, summary: string) => result.ok && edit(result.doc, summary);

  function runBar(id: ActionId) {
    if (!session || !doc) {
      return;
    }
    const done = barAction(id, { doc, selection: session.selection, frame: FIRST_FRAME, newId: () => crypto.randomUUID().slice(0, 8) });
    if (!done) {
      return;
    }
    session.edit(done.doc, done.summary);
    session.select(done.selection);
  }
</script>

{#snippet partLead()}{#if part && shown?.clip && doc && tokens}<PosterPartPanel gesture={session?.live} {doc} clip={shown.clip} {part} {assets} {upload} {tokens} onchange={edit} />{/if}{/snippet}

{#if session && doc && tokens && !session.selection.length}
  <aside class="frame-inspector" data-testid="frame-inspector" aria-label="Properties">
    <DocFields gesture={session.live} {doc} {assets} {upload} onchange={edit} />
    <CameraInspector {doc} frame={FIRST_FRAME} onchange={edit} />
    <LayoutGuidesSection {doc} onchange={editGuides} />
  </aside>
{:else if session && doc && tokens && shown}
  <aside class="frame-inspector" data-testid="frame-inspector" aria-label="Properties">
    <ClipBar {doc} selection={session.selection} pick={PickMode.One} onrun={runBar} ondone={() => {}} />
    {#if shown.view === PropertiesView.Multiple}
      <MultiInspector {doc} ids={session.selection} frame={FIRST_FRAME} onchange={edit} />
    {:else}
      {@const Presets = CLIP_PRESETS[shown.clip.component]}
      <MotionInspector gesture={session.live} lead={partLead} {doc} clip={shown.clip} {tokens} {assets} {fonts} {upload} {analyses} frame={FIRST_FRAME} onchange={edit} />
      {#if Presets}<Presets {doc} clip={shown.clip} onchange={edit} />{/if}
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

  .empty {
    margin: 0;
    padding: var(--ui-space-4);
    color: var(--ui-text-secondary);
    font-size: var(--ui-type-caption);
  }
</style>
