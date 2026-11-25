<script lang="ts">
  import type { Present } from '../../../packages/share-protocol/src/frame';
  import type { Rect } from '../messages';
  import { colourOf } from './peers';

  let { peers, rects, scale }: { peers: Present[]; rects: Record<string, Rect | null>; scale: number } = $props();
</script>

{#each peers as peer (peer.userId)}
  {@const rect = rects[peer.userId]}
  {#if rect}
    <div class="peer-outline" data-testid="peer-outline" style={`--peer:${colourOf(peer.userId)};left:${rect.x * scale}px;top:${rect.y * scale}px;width:${rect.width * scale}px;height:${rect.height * scale}px`}>
      <span class="peer-name">{peer.name}</span>
    </div>
  {/if}
  {#if peer.cursor}
    <div class="peer-cursor" data-testid="peer-cursor" style={`--peer:${colourOf(peer.userId)};left:${peer.cursor.x * scale}px;top:${peer.cursor.y * scale}px`}>
      <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true"><path d="M1 1l11 6-5 1.5L5.5 14z" fill="var(--peer)" stroke="#fff" stroke-width="1" /></svg>
      <span class="peer-name">{peer.name}</span>
    </div>
  {/if}
{/each}

<style>
  .peer-outline,
  .peer-cursor {
    position: absolute;
    pointer-events: none;
  }

  .peer-outline {
    outline: 2px solid var(--peer);
  }

  .peer-outline .peer-name {
    position: absolute;
    left: 0;
    bottom: 100%;
  }

  .peer-cursor {
    display: flex;
    align-items: flex-start;
    gap: 2px;
  }

  .peer-name {
    padding: 1px 6px;
    border-radius: var(--ui-radius-sm);
    background: var(--peer);
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    white-space: nowrap;
  }
</style>
