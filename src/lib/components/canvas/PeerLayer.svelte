<script lang="ts">
  import type { CanvasPeer } from '$lib/realtime/canvas-presence';
  import { displayName } from '$lib/realtime/frame-presence';

  type Rect = { x: number; y: number; w: number; h: number };

  let { peers, rectOf, zoom }: { peers: CanvasPeer[]; rectOf: (id: string) => Rect | null; zoom: number } = $props();

  const OUTLINE_PX = 2;

  const outlines = $derived(peers.flatMap((peer) => peer.selection.flatMap((id) => {
    const rect = rectOf(id);
    return rect ? [{ key: `${peer.sessionId}:${id}`, rect, colour: peer.colour }] : [];
  })));
</script>

<div class="peers" data-testid="peer-layer" style:--inverse={1 / zoom}>
  {#each outlines as outline (outline.key)}
    <div
      class="outline"
      data-testid="peer-selection"
      style:left="{outline.rect.x}px"
      style:top="{outline.rect.y}px"
      style:width="{outline.rect.w}px"
      style:height="{outline.rect.h}px"
      style:border-width="{OUTLINE_PX / zoom}px"
      style:border-color={outline.colour}
    ></div>
  {/each}
  {#each peers as peer (peer.sessionId)}
    {#if peer.cursor}
      <div class="cursor" data-testid="peer-cursor" data-user={peer.userId} style:transform="translate({peer.cursor.x}px, {peer.cursor.y}px) scale(var(--inverse))">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M1 1 L1 13 L5 9.5 L8 15 L10 14 L7 8.5 L12 8.5 Z" fill={peer.colour} stroke="#fff" stroke-width="1" /></svg>
        <span class="name" style:background={peer.colour}>{displayName(peer.name)}</span>
      </div>
    {/if}
  {/each}
</div>

<style>
  .peers { position: absolute; inset: 0; pointer-events: none; z-index: 1000; }
  .outline { position: absolute; border-style: solid; box-sizing: border-box; }
  .cursor { position: absolute; left: 0; top: 0; transform-origin: 0 0; transition: transform 50ms linear; will-change: transform; }
  .name { position: absolute; left: 14px; top: 14px; padding: 2px 6px; color: #fff; font-size: 11px; line-height: 14px; white-space: nowrap; border-radius: 9999px; }
</style>
