<script lang="ts">
  import MotionInspector from '$lib/components/motion/MotionInspector.svelte';
  import MultiInspector from '$lib/components/motion/MultiInspector.svelte';
  import LookInspector from '$lib/components/motion/LookInspector.svelte';
  import ClipBar from '$lib/components/motion/ClipBar.svelte';
  import type { FrameEditSession } from '$lib/motion/frame-edit-session.svelte';
  import type { BrandTokens } from '$lib/motion/brand';
  import type { ComponentProps } from 'svelte';
  import { THREE_D_COMPONENTS } from '$lib/motion/components';
  import { PickMode } from '$lib/motion/clip-bar';
  import { PropertiesView } from '$lib/motion/properties-view';
  import { barAction, inspectorOf } from '$lib/canvas/frame-inspector';
  import type { ActionId } from '$lib/motion/actions';

  const FIRST_FRAME = 0;

  let {
    session,
    tokens,
    assets = [],
    fonts = null,
    upload = null,
    analyses = {}
  }: {
    session: FrameEditSession | null;
    tokens: BrandTokens | null;
    assets?: ComponentProps<typeof MotionInspector>['assets'];
    fonts?: ComponentProps<typeof MotionInspector>['fonts'];
    upload?: ComponentProps<typeof MotionInspector>['upload'];
    analyses?: ComponentProps<typeof MotionInspector>['analyses'];
  } = $props();

  const doc = $derived(session?.history.present ?? null);
  const shown = $derived(session && doc ? inspectorOf(doc, session.selection) : null);
  const edit = (next: NonNullable<typeof doc>, summary: string) => session?.edit(next, summary);

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

{#if session && doc && tokens && shown}
  <aside class="frame-inspector" data-testid="frame-inspector" aria-label="Properties">
    <ClipBar {doc} selection={session.selection} pick={PickMode.One} onrun={runBar} ondone={() => {}} />
    {#if shown.view === PropertiesView.Multiple}
      <MultiInspector {doc} ids={session.selection} frame={FIRST_FRAME} onchange={edit} />
    {:else}
      <MotionInspector gesture={session.live} {doc} clip={shown.clip} {tokens} {assets} {fonts} {upload} {analyses} frame={FIRST_FRAME} onchange={edit} />
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
