<script lang="ts">
  import CanvasFlow, { type Tile } from '$lib/components/canvas/CanvasFlow.svelte';
  import { nodeSize } from '$lib/canvas/node-size';
  import { PosterSource } from '$lib/canvas/poster-lod';
  import LiveVideo from '$lib/components/canvas/LiveVideo.svelte';
  import MotionNode from '$lib/components/canvas/MotionNode.svelte';
  import { FrameKind } from '$lib/canvas/motion-node';
  import { frameDocs } from '$lib/canvas/frame-docs.svelte';
  import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
  import { FEEGA_TOKENS } from '$lib/motion/brand';
  import { composeHtml } from '$lib/motion/hyperframes/compose';
  import { insertTemplate, setTemplateValues } from '$lib/motion/template/library';
  import { SPLIT_HEADLINE_TEMPLATE } from '$lib/motion/template/split-headline/template';
  import type { HarnessNode } from './motion-canvas-harness';

  let { nodes }: { nodes: HarnessNode[] } = $props();

  const DOM_ONLY = '-dom';
  const sourceOf = (node: HarnessNode) => (node.source?.startsWith(PosterSource.VideoFrame) ? PosterSource.VideoFrame : PosterSource.Image);
  const layered = (node: HarnessNode) => !node.source?.endsWith(DOM_ONLY);

  const tiles: Tile[] = nodes.map((node) => {
    const size = nodeSize('motion', { format: node.format });
    return { id: node.id, x: node.x, y: node.y, w: size.w, h: size.h, kind: 'motion', poster: layered(node) ? { url: node.poster, source: sourceOf(node) } : undefined };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const LIVE = 'live';
  const PHOTO = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#777"/></svg>');

  function liveDoc(format: MotionFormat) {
    let n = 0;
    const placed = insertTemplate(newMotionDoc(format), SPLIT_HEADLINE_TEMPLATE, { from: 0, newId: () => `f${++n}` });
    if (!placed.ok) {
      throw new Error(placed.error);
    }
    const set = setTemplateValues(placed.doc, placed.clipId, { media: 'photo' });
    if (!set.ok) {
      throw new Error(set.error);
    }
    return set.doc;
  }

  for (const node of nodes.filter((n) => n.source === LIVE)) {
    const doc = liveDoc(node.format as MotionFormat);
    frameDocs.put(node.id, { version: 1, html: composeHtml({ doc, tokens: FEEGA_TOKENS, assets: { photo: PHOTO } }), width: doc.width, height: doc.height, fps: doc.fps, durationInFrames: doc.durationInFrames });
  }

  const frameOf = (node: HarnessNode) => ({ id: node.id, kind: FrameKind.Frame, format: node.format as MotionFormat, docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null });
</script>

<div class="harness">
  <CanvasFlow {tiles} onSelectionChange={() => (window.selectionEmits = (window.selectionEmits ?? 0) + 1)}>
    {#snippet tile({ id, selected })}
      {@const node = byId.get(id)!}
      <div class="stage" data-testid="motion-node">
        {#if node.source === LIVE}
          <MotionNode node={frameOf(node)} href="#" previewUrl="/" posterUrl={null} />
        {:else if sourceOf(node) === PosterSource.VideoFrame}
          <LiveVideo src={node.poster} nodeId={id} {selected} controls muted />
        {:else}
          <img class="poster" src={node.poster} alt="" draggable="false" loading="lazy" decoding="async" />
        {/if}
      </div>
    {/snippet}
  </CanvasFlow>
</div>

<style>
  .harness {
    position: fixed;
    inset: 0;
  }
  .stage {
    width: 100%;
    height: 100%;
    background: #000;
  }
  .poster {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
