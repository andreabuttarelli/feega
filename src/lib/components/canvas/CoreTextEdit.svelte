<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { editCss, type EditLayout, type TextEditStyle } from '$lib/canvas/frame-text-edit';
  import { textRange } from '$lib/canvas/text-range.svelte';
  import { codeIndex, RunToggle, STYLE_KEYS, type RunEdit, type RunStyle, type TextRun } from '$lib/motion/text-runs';

  let { layout, look, text, clipId = '', base = {}, runs: initialRuns = [], styled = false, oncommit }: { layout: EditLayout; look: TextEditStyle; text: string; clipId?: string; base?: RunStyle; runs?: TextRun[]; styled?: boolean; oncommit: (text: string, runs: TextRun[]) => void } = $props();

  let field = $state<HTMLTextAreaElement>();
  let value = $state('');
  let tint = $state('#000000');

  const SHORTCUTS: Record<string, RunEdit> = { b: { weight: RunToggle.Bold }, i: { italic: RunToggle.Italic }, u: { underline: RunToggle.Underline } };
  const PANEL = '[data-text-range-panel]';
  const CLEARED: RunEdit = Object.fromEntries(STYLE_KEYS.map((k) => [k, null]));
  const picked = $derived(textRange.range);
  let composing = false;
  let ended = false;

  const style = $derived(editCss(look, layout));
  let barAt = $state({ left: 0, top: 0 });
  let laid: number | null = null;

  const CARET_PX = 2;
  const BAR_GAP_PX = 32;

  function fit() {
    if (!field) {
      return;
    }
    field.style.height = '0';
    if (!layout.wraps) {
      field.style.width = '0';
      field.style.width = `${field.scrollWidth + CARET_PX}px`;
    }
    const content = field.scrollHeight;
    laid ??= content;
    field.style.marginTop = layout.centred ? `${(laid - content) / 2}px` : '0';
    field.style.height = `${content}px`;
    const own = field.getBoundingClientRect();
    const host = field.offsetParent?.getBoundingClientRect() ?? own;
    barAt = { left: own.left - host.left, top: own.top - host.top - BAR_GAP_PX };
  }

  $effect(() => {
    void style;
    fit();
  });

  function end() {
    if (ended) {
      return;
    }
    ended = true;
    const runs = textRange.runs;
    textRange.close();
    oncommit(value, runs);
  }

  let bar = $state<HTMLDivElement>();

  const kept = (target: EventTarget | null) => target instanceof Element && ((bar?.contains(target) ?? false) || target === field || target.closest(PANEL) !== null);

  function left(e: FocusEvent) {
    if (kept(e.relatedTarget)) {
      return;
    }
    end();
  }

  function outside(e: PointerEvent) {
    if (!kept(e.target)) {
      end();
    }
  }

  function refocus() {
    field?.focus();
  }

  function retyped() {
    textRange.retype(value);
    fit();
  }

  function selected() {
    if (!field) {
      return;
    }
    textRange.select({ start: codeIndex(value, field.selectionStart), end: codeIndex(value, field.selectionEnd) });
  }

  function restyle(edit: RunEdit) {
    textRange.restyle(edit);
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

  onMount(() => {
    value = text;
    textRange.open({ clipId: styled ? clipId : '', text, runs: initialRuns, base });
    window.addEventListener('pointerdown', outside, true);
    const follow = () => document.activeElement === field && selected();
    document.addEventListener('selectionchange', follow);
    void tick().then(() => {
      fit();
      field?.focus();
      field?.select();
    });
    return () => {
      window.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('selectionchange', follow);
    };
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
  <div bind:this={bar} class="range" data-testid="text-range-bar" role="toolbar" tabindex="-1" style="left:{barAt.left}px;top:{barAt.top}px" onmousedown={(e) => e.target instanceof HTMLButtonElement && e.preventDefault()} onpointerdown={(e) => e.stopPropagation()}>
    <button type="button" data-testid="text-range-bold" title="Bold (⌘B)" onclick={() => restyle({ weight: RunToggle.Bold })}><b>B</b></button>
    <button type="button" data-testid="text-range-italic" title="Italic (⌘I)" onclick={() => restyle({ italic: RunToggle.Italic })}><i>I</i></button>
    <input type="color" data-testid="text-range-colour" title="Colour" bind:value={tint} onchange={() => {
        restyle({ color: tint });
        refocus();
      }} />
    <button type="button" data-testid="text-range-clear" title="Clear range style" onclick={() => restyle(CLEARED)}>×</button>
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
  }
</style>
