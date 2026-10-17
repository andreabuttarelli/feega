<script lang="ts">
  import type { CanvasPeer } from '$lib/realtime/canvas-presence';
  import { displayName } from '$lib/realtime/frame-presence';

  type Rect = { x: number; y: number; w: number; h: number };

  let { peers, rectOf, zoom }: { peers: CanvasPeer[]; rectOf: (id: string) => Rect | null; zoom: number } = $props();

  const OUTLINE_PX = 2;

  function boxesOf(peer: CanvasPeer) {
    const moving = new Map(peer.live.map((box) => [box.id, box]));
    return [...new Set([...peer.selection, ...moving.keys()])].flatMap((id) => {
      const rect = rectOf(id);
      const box = moving.get(id);
      if (!rect && !(box?.w && box.h)) {
        return [];
      }
      const at = { x: box?.x ?? rect!.x, y: box?.y ?? rect!.y, w: box?.w ?? rect!.w, h: box?.h ?? rect!.h };
      return [{ key: `${peer.sessionId}:${id}`, rect: at, colour: peer.colour, live: !!box }];
    });
  }

  const outlines = $derived(peers.flatMap(boxesOf));
</script>

<div class="peers" data-testid="peer-layer" style:--inverse={1 / zoom}>
  {#each outlines as outline (outline.key)}
    <div
      class="outline"
      class:live={outline.live}
      data-testid={outline.live ? 'peer-ghost' : 'peer-selection'}
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
  .outline.live { border-style: dashed; transition: left 50ms linear, top 50ms linear, width 50ms linear, height 50ms linear; }
  .cursor { position: absolute; left: 0; top: 0; transform-origin: 0 0; transition: transform 50ms linear; will-change: transform; }
  .name { position: absolute; left: 14px; top: 14px; padding: 2px 6px; color: #fff; font-size: 11px; line-height: 14px; white-space: nowrap; border-radius: 9999px; }
</style>
