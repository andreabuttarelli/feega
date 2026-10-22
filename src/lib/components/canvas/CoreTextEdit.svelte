<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { TextEditStyle } from '$lib/canvas/frame-text-edit';
  import { codeIndex, codePoints, RunToggle, shiftRuns, styledRange, type RunEdit, type TextRun } from '$lib/motion/text-runs';

  type Rect = { left: number; top: number; width: number; height: number };

  let { rect, look, text, runs: initialRuns = [], styled = false, oncommit }: { rect: Rect; look: TextEditStyle; text: string; runs?: TextRun[]; styled?: boolean; oncommit: (text: string, runs: TextRun[]) => void } = $props();

  let field = $state<HTMLTextAreaElement>();
  let value = $state('');
  let runs = $state<TextRun[]>([]);
  let typed = '';
  let picked = $state({ start: 0, end: 0 });
  let tint = $state('#000000');

  const SHORTCUTS: Record<string, RunEdit> = { b: { weight: RunToggle.Bold }, i: { italic: RunToggle.Italic } };
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
    oncommit(value, runs);
  }

  let bar = $state<HTMLDivElement>();

  function left(e: FocusEvent) {
    if (bar && e.relatedTarget instanceof Node && bar.contains(e.relatedTarget)) {
      return;
    }
    end();
  }

  function refocus() {
    field?.focus();
  }

  function retyped() {
    runs = shiftRuns(runs, typed, value);
    typed = value;
    fit();
  }

  function selected() {
    if (!field) {
      return;
    }
    picked = { start: codeIndex(value, field.selectionStart), end: codeIndex(value, field.selectionEnd) };
  }

  function restyle(edit: RunEdit) {
    if (picked.start === picked.end) {
      return;
    }
    runs = styledRange(runs, picked, edit, codePoints(value).length);
  }

  function onKey(e: KeyboardEvent) {
    const shortcut = styled && (e.metaKey || e.ctrlKey) ? SHORTCUTS[e.key.toLowerCase()] : undefined;
    if (shortcut) {
      e.preventDefault();
      e.stopPropagation();
      selected();
      restyle(shortcut);
      return;
    }
    if (e.key === 'Escape' && !composing) {
      e.preventDefault();
      e.stopPropagation();
      end();
    }
  }

  onMount(async () => {
    value = text;
    typed = text;
    runs = initialRuns;
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
  oninput={retyped}
  onkeydown={onKey}
  onselect={selected}
  onkeyup={selected}
  onpointerup={selected}
  oncompositionstart={() => (composing = true)}
  oncompositionend={() => (composing = false)}
  onblur={left}
  onpointerdown={(e) => e.stopPropagation()}
  ondblclick={(e) => e.stopPropagation()}
></textarea>

{#if styled && picked.start !== picked.end}
  <div bind:this={bar} class="range" data-testid="text-range-bar" role="toolbar" tabindex="-1" style="left:{rect.left}px;top:{rect.top - 32}px" onmousedown={(e) => e.target instanceof HTMLButtonElement && e.preventDefault()} onpointerdown={(e) => e.stopPropagation()}>
    <button type="button" data-testid="text-range-bold" title="Bold (⌘B)" onclick={() => restyle({ weight: RunToggle.Bold })}><b>B</b></button>
    <button type="button" data-testid="text-range-italic" title="Italic (⌘I)" onclick={() => restyle({ italic: RunToggle.Italic })}><i>I</i></button>
    <input type="color" data-testid="text-range-colour" title="Colour" bind:value={tint} onchange={() => {
        restyle({ color: tint });
        refocus();
      }} />
    <button type="button" data-testid="text-range-clear" title="Clear range style" onclick={() => restyle({ color: null, weight: null, italic: null })}>×</button>
  </div>
{/if}

<style>
  .range {
    position: absolute;
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-surface, #fff);
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.15);
    pointer-events: auto;
    font: 12px/1 system-ui;
  }

  .range button,
  .range input {
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text, #111);
    cursor: pointer;
  }

  .range button:hover {
    background: var(--ui-hover, rgb(0 0 0 / 0.06));
  }

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
