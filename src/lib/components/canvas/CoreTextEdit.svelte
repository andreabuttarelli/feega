<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { TextEditStyle } from '$lib/canvas/frame-text-edit';

  type Rect = { left: number; top: number; width: number; height: number };

  let { rect, look, text, oncommit }: { rect: Rect; look: TextEditStyle; text: string; oncommit: (text: string) => void } = $props();

  let field = $state<HTMLTextAreaElement>();
  let value = $state('');
  let composing = false;
  let ended = false;

  const style = $derived(
    `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;font:${look.italic ? 'italic ' : ''}${look.weight} ${look.fontPx}px/${look.leading} ${look.family};letter-spacing:${look.trackingEm}em;color:${look.color};caret-color:${look.color};text-align:${look.align};${look.upper ? 'text-transform:uppercase' : ''}`
  );

  function fit() {
    if (!field) {
      return;
    }
    field.style.paddingTop = '0';
    field.style.height = '0';
    const content = field.scrollHeight;
    field.style.paddingTop = `${Math.max(0, (rect.height - content) / 2)}px`;
    field.style.height = `${Math.max(rect.height, content)}px`;
  }

  function end() {
    if (ended) {
      return;
    }
    ended = true;
    oncommit(value);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && !composing) {
      e.preventDefault();
      e.stopPropagation();
      end();
    }
  }

  onMount(async () => {
    value = text;
    await tick();
    fit();
    field?.focus();
    field?.select();
  });
</script>

<textarea
  bind:this={field}
  bind:value
  class="edit"
  data-testid="core-text-edit"
  {style}
  rows="1"
  spellcheck="false"
  oninput={fit}
  onkeydown={onKey}
  oncompositionstart={() => (composing = true)}
  oncompositionend={() => (composing = false)}
  onblur={end}
  onpointerdown={(e) => e.stopPropagation()}
  ondblclick={(e) => e.stopPropagation()}
></textarea>

<style>
  .edit {
    position: absolute;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border: 0;
    outline: 1px solid var(--ui-accent, #3b82f6);
    background: transparent;
    resize: none;
    overflow: hidden;
    pointer-events: auto;
    white-space: pre-wrap;
  }
</style>
