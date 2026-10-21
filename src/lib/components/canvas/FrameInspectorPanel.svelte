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

  let { session, tokens, assets = [] }: { session: FrameEditSession; tokens: BrandTokens; assets?: ComponentProps<typeof MotionInspector>['assets'] } = $props();

  const doc = $derived(session.history.present);
  const shown = $derived(inspectorOf(doc, session.selection));
  const edit = (next: typeof doc, summary: string) => session.edit(next, summary);

  function runBar(id: ActionId) {
    const done = barAction(id, { doc, selection: session.selection, frame: FIRST_FRAME, newId: () => crypto.randomUUID().slice(0, 8) });
    if (!done) {
      return;
    }
    session.edit(done.doc, done.summary);
    session.select(done.selection);
  }
</script>

{#if shown}
  <aside class="frame-inspector" data-testid="frame-inspector" aria-label="Properties">
    <ClipBar {doc} selection={session.selection} pick={PickMode.One} onrun={runBar} ondone={() => {}} />
    {#if shown.view === PropertiesView.Multiple}
      <MultiInspector {doc} ids={session.selection} frame={FIRST_FRAME} onchange={edit} />
    {:else}
      <MotionInspector gesture={session.live} {doc} clip={shown.clip} {tokens} {assets} frame={FIRST_FRAME} onchange={edit} />
      {#if THREE_D_COMPONENTS.includes(shown.clip.component)}<LookInspector gesture={session.live} {doc} onchange={edit} />{/if}
    {/if}
  </aside>
{/if}

<style>
  .frame-inspector {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 280px;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--ui-surface, var(--background));
    border-left: 1px solid var(--ui-border, var(--border));
    z-index: 20;
  }
</style>
