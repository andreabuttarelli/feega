<script lang="ts">
  import { findClip, type MotionDoc } from '$lib/motion/doc';
  import type { MeasuredBox } from '$lib/motion/hyperframes/measure';
  import { quadOf, type Quad } from '$lib/motion/scene-select';
  import { displayName, type FrameCursor, type FramePeer } from '$lib/realtime/frame-presence';

  let {
    doc,
    frame,
    redraws,
    peers,
    measure,
    onpointer
  }: {
    doc: MotionDoc;
    frame: number;
    redraws: number;
    peers: FramePeer[];
    measure: () => Promise<Record<string, MeasuredBox>>;
    onpointer: (cursor: FrameCursor | null) => void;
  } = $props();

  let host = $state<HTMLDivElement | null>(null);
  let boxes = $state<Record<string, MeasuredBox>>({});

  const wanted = $derived([...new Set(peers.flatMap((p) => p.selection))].sort().join(','));

  const SETTLE_MS = 300;

  const inDoc = (measured: Record<string, MeasuredBox>) =>
    Object.fromEntries(Object.entries(measured).map(([id, b]) => [id, { left: b.left * doc.width, top: b.top * doc.height, width: b.width * doc.width, height: b.height * doc.height }]));

  $effect(() => {
    void doc;
    void frame;
    void redraws;
    if (!wanted) {
      return;
    }
    let live = true;
    const read = () => void measure().then((measured) => live && Object.keys(measured).length && (boxes = inDoc(measured)));
    read();
    const later = setTimeout(read, SETTLE_MS);
    return () => {
      live = false;
      clearTimeout(later);
    };
  });

  const onFrame = (id: string) => {
    const clip = findClip(doc, id)?.clip;
    return clip && frame >= clip.from && frame < clip.from + clip.durationInFrames;
  };

  const outlines = $derived(
    peers.flatMap((peer) => peer.selection.filter((id) => boxes[id] && onFrame(id)).map((id) => ({ key: `${peer.userId}:${id}`, colour: peer.colour, quad: quadOf(doc, id, frame, boxes[id]) })))
  );

  const points = (quad: Quad) => quad.map((p) => p.join(',')).join(' ');

  function track(e: PointerEvent) {
    const rect = host?.getBoundingClientRect();
    if (!rect?.width || !rect.height) {
      return;
    }
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onpointer(x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null);
  }
</script>

<svelte:window onpointermove={track} />

<div class="peers" bind:this={host} data-testid="frame-peers" aria-hidden="true">
  <svg viewBox={`0 0 ${doc.width} ${doc.height}`} preserveAspectRatio="none">
    {#each outlines as o (o.key)}
      <polygon points={points(o.quad)} style:stroke={o.colour} data-testid="peer-selection" />
    {/each}
  </svg>
  {#each peers.filter((p) => p.cursor) as peer (peer.userId)}
    <div class="cursor" style:left={`${peer.cursor!.x * 100}%`} style:top={`${peer.cursor!.y * 100}%`} style:--peer={peer.colour} data-testid="peer-cursor">
      <svg viewBox="0 0 16 16" width="16" height="16"><path d="M1 1 L1 13 L5 9.5 L8 15 L10 14 L7 8.5 L12 8.5 Z" /></svg>
      <span>{displayName(peer.name)}</span>
    </div>
  {/each}
</div>

<style>
  .peers {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 3;
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  polygon {
    fill: none;
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }

  .cursor {
    position: absolute;
    display: flex;
    align-items: flex-start;
    gap: 2px;
    transition:
      left 80ms linear,
      top 80ms linear;
  }

  .cursor svg {
    position: static;
    width: 16px;
    height: 16px;
    fill: var(--peer);
    stroke: white;
    stroke-width: 1;
  }

  .cursor span {
    margin-top: 12px;
    padding: 3px 10px;
    border-radius: var(--ui-radius-full);
    background: var(--peer);
    box-shadow: var(--ui-shadow-raised);
    color: white;
    font-size: var(--ui-type-label);
    font-weight: var(--ui-weight-semibold);
    line-height: 16px;
    white-space: nowrap;
  }
</style>
