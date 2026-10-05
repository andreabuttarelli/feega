<script lang="ts">
  import TieredImage from './TieredImage.svelte';
  import Orbit from '@lucide/svelte/icons/orbit';
  import { staleMotions, type CompositionNode, type MotionCard, type UpstreamCard } from '$lib/canvas/composition-node';
  import { motionSourcePath } from '$lib/canvas/motion-node';
  import CompositionPlayer from '$lib/components/motion/CompositionPlayer.svelte';
  import NodeDownload from './NodeDownload.svelte';
  import { nodeDoc } from '$lib/motion/composition-draft';
  import type { MotionDoc } from '$lib/motion/doc';

  let {
    node,
    posterUrl = null,
    cards = [],
    assets = {},
    previewActive = true,
    composeIn
  }: {
    node: CompositionNode;
    posterUrl?: string | null;
    cards?: UpstreamCard[];
    assets?: Record<string, string>;
    previewActive?: boolean;
    composeIn: { project: string; canvas: string };
  } = $props();

  const ASPECT_RATIO = { '9:16': 9 / 16, '1:1': 1, '16:9': 16 / 9 } as const;

  type Loaded = { revision: number; doc: MotionDoc | null; assets: Record<string, string> };

  let sources = $state<Record<string, Loaded>>({});

  async function load(card: MotionCard) {
    const shown = sources[card.sourceId];
    sources = { ...sources, [card.sourceId]: { revision: card.revision, doc: shown?.doc ?? null, assets: shown?.assets ?? {} } };
    const res = await fetch(motionSourcePath({ projectId: composeIn.project, canvasId: composeIn.canvas, nodeId: card.sourceId, revision: card.revision })).catch(() => null);
    const body = res?.ok ? ((await res.json()) as { doc: MotionDoc; assets: Record<string, string> }) : null;
    sources = { ...sources, [card.sourceId]: { revision: card.revision, doc: body?.doc ?? null, assets: body?.assets ?? {} } };
  }

  $effect(() => {
    const revisions = Object.fromEntries(Object.entries(sources).map(([id, s]) => [id, s.revision]));
    staleMotions(cards, revisions).forEach(load);
  });

  const motions = $derived(Object.fromEntries(Object.entries(sources).map(([id, s]) => [id, s.doc])));
  const allAssets = $derived(Object.assign({}, assets, ...Object.values(sources).map((s) => s.assets)));

  let form = $state<HTMLFormElement | null>(null);
  const openInCompositions = () => form?.requestSubmit();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="composition" ondblclick={openInCompositions}>
  {#if cards.length > 0}
    <div
      class="composition-preview"
      style={`--preview-ratio: ${ASPECT_RATIO[node.aspect]}; aspect-ratio: ${ASPECT_RATIO[node.aspect]}`}
    >
      <CompositionPlayer doc={nodeDoc(node, cards, motions)} assets={allAssets} active={previewActive} />
    </div>
  {:else if node.refId && posterUrl}
    <TieredImage src={posterUrl} nodeId={node.id} alt="Composition" />
  {:else}
    <div class="composition-empty">
      <Orbit size={22} strokeWidth={1.5} />
      <p>Connect images, videos or motions</p>
    </div>
  {/if}

  <div class="composition-actions">
    {#if node.refId && posterUrl}
      <NodeDownload kind="video" sourceUrl={posterUrl} nodeId={node.id} nodeType="composizione" />
    {/if}
    <form bind:this={form} method="POST" action="/app/compose?/fromNode" class="nodrag">
      <input type="hidden" name="project" value={composeIn.project} />
      <input type="hidden" name="canvas" value={composeIn.canvas} />
      <input type="hidden" name="node" value={node.id} />
      <button type="submit" class="composition-action" title="Edit and export in Compositions">Open editor</button>
    </form>
  </div>
</div>

<style>
  .composition {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 0;
    background: var(--paper, #fff);
    border: 1px solid var(--line, #e5e5e5);
    box-shadow:
      0 1px 2px rgb(0 0 0 / 0.05),
      0 8px 24px -12px rgb(0 0 0 / 0.2);
    overflow: hidden;
    container-type: size;
    transition: box-shadow 140ms ease;
  }
  .composition:hover {
    box-shadow:
      0 1px 2px rgb(0 0 0 / 0.06),
      0 12px 32px -14px rgb(0 0 0 / 0.26);
  }
  @media (prefers-reduced-motion: reduce) {
  .composition {
      transition: none;
    }
  }

  .composition-preview {
    max-width: 100%;
    max-height: 100%;
    width: min(100%, calc(100cqh * var(--preview-ratio)));
    height: auto;
    overflow: hidden;
  }

  .composition-actions {
    position: absolute;
    right: 8px;
    top: 8px;
    display: flex;
    gap: 4px;
  }

  .composition-action {
    padding: 3px 8px;
    font: inherit;
    font-size: 11px;
    border: 1px solid var(--line, #e5e5e5);
    background: var(--paper, #fff);
    color: var(--ink, #1d1d1f);
    cursor: pointer;
  }


  .composition-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px;
    color: var(--ink-soft, #6e6e73);
    text-align: center;
  }

  .composition-empty p {
    margin: 0;
    font-size: 11.5px;
  }
</style>
