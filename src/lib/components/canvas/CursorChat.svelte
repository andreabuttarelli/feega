<script lang="ts">
  import { CHAT_MAX } from '$lib/realtime/canvas-presence';

  let { onchat }: { onchat: (text: string | null) => void } = $props();

  const OPEN_KEY = '/';
  const CLOSE_KEYS = new Set(['Escape', 'Enter']);
  const OFFSET_PX = 16;

  let at = $state<{ x: number; y: number } | null>(null);
  let last = { x: 0, y: 0 };
  let text = $state('');
  let field = $state<HTMLInputElement | null>(null);

  const editing = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

  function open(e: KeyboardEvent) {
    if (e.key !== OPEN_KEY || at || editing(e.target)) {
      return;
    }
    e.preventDefault();
    at = { ...last };
    text = '';
    queueMicrotask(() => field?.focus());
  }

  function close() {
    at = null;
    text = '';
    onchat(null);
  }
</script>

<svelte:window onkeydown={open} onpointermove={(e) => (last = { x: e.clientX, y: e.clientY })} />

{#if at}
  <input
    bind:this={field}
    class="cursor-chat"
    data-testid="cursor-chat"
    aria-label="Say something to everyone here"
    placeholder="Say something"
    maxlength={CHAT_MAX}
    style:left="{at.x + OFFSET_PX}px"
    style:top="{at.y + OFFSET_PX}px"
    bind:value={text}
    oninput={() => onchat(text || null)}
    onkeydown={(e) => CLOSE_KEYS.has(e.key) && close()}
    onblur={close}
  />
{/if}

<style>
  .cursor-chat {
    position: fixed;
    z-index: 1000;
    min-width: 160px;
    padding: 6px 12px;
    border: 0;
    border-radius: 9999px;
    background: var(--ui-accent, #0090ff);
    color: white;
    font-size: 13px;
    outline: none;
  }
</style>
