<script lang="ts">
  import type { CommentThread } from '$lib/canvas/comment-threads';

  let { thread, active, onpick }: { thread: CommentThread; active: boolean; onpick: (id: string) => void } = $props();
</script>

<button
  type="button"
  class="pin"
  class:active
  data-testid="comment-pin"
  data-thread={thread.id}
  aria-label={`Comment ${thread.number}`}
  style={`left:${thread.x}px;top:${thread.y}px`}
  onpointerdown={(e) => e.stopPropagation()}
  onclick={(e) => {
    e.stopPropagation();
    onpick(thread.id);
  }}
>
  {thread.number}
</button>

<style>
  .pin {
    position: absolute;
    z-index: 5;
    width: 24px;
    height: 24px;
    padding: 0;
    display: grid;
    place-items: center;
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    color: var(--paper, #fff);
    background: var(--ink, #1d1d1f);
    border: 2px solid var(--paper, #fff);
    border-radius: 9999px 9999px 9999px 0;
    transform-origin: 0 100%;
    transform: translate(0, -100%) scale(calc(1 / var(--zoom, 1)));
    pointer-events: auto;
  }

  .pin.active {
    background: #0b6bff;
  }
</style>
