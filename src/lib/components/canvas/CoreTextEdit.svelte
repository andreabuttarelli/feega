<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { editCss, type EditBody, type EditLayout, type TextEditStyle } from '$lib/canvas/frame-text-edit';
  import { rangeOf, select, selectionIn, textOf, type Span } from '$lib/canvas/editable-text';
  import { textRange } from '$lib/canvas/text-range.svelte';
  import GradientHandles from './GradientHandles.svelte';
  import { ListKind, type ListItem } from '$lib/motion/text-lists';
  import { codeIndex, linkOf, MIXED, RunToggle, STYLE_KEYS, type GradientFill, type RunEdit, type RunStyle, type TextRun } from '$lib/motion/text-runs';

  let { layout, look, text, body, clipId = '', base = {}, runs: initialRuns = [], lists: initialLists = [], styled = false, oncommit }: { layout: EditLayout; look: TextEditStyle; text: string; body: EditBody; clipId?: string; base?: RunStyle; runs?: TextRun[]; lists?: ListItem[]; styled?: boolean; oncommit: (text: string, runs: TextRun[], lists: ListItem[]) => void } = $props();

  type Box = { left: number; top: number; width: number; height: number };
  type Snapshot = { text: string; runs: TextRun[]; lists: ListItem[]; sel: Span };

  let field = $state<HTMLDivElement>();
  let rangeBox = $state<Box | null>(null);
  let value = $state('');
  let tint = $state('#000000');
  let linkOpen = $state(false);
  let linkField = $state<HTMLInputElement>();

  const SHORTCUTS: Record<string, RunEdit> = { b: { weight: RunToggle.Bold }, i: { italic: RunToggle.Italic }, u: { underline: RunToggle.Underline } };
  const PANEL = '[data-text-range-panel]';
  const CLEARED: RunEdit = Object.fromEntries(STYLE_KEYS.map((k) => [k, null]));
  const HISTORY_LIMIT = 200;
  const NEWLINE = '\n';
  const picked = $derived(textRange.range);
  let composing = false;
  let ended = false;
  let sel: Span = { start: 0, end: 0 };
  const past: Snapshot[] = [];
  const future: Snapshot[] = [];

  const style = $derived(editCss(look, layout));
  let barAt = $state({ left: 0, top: 0 });
  let laid: number | null = null;

  const CARET_PX = 2;
  const BAR_GAP_PX = 32;

  function fit() {
    if (!field?.firstChild) {
      return;
    }
    field.style.height = '0';
    if (!layout.wraps) {
      field.style.width = '0';
      field.style.width = `${field.scrollWidth + CARET_PX}px`;
    }
    const content = field.scrollHeight;
    laid ??= content;
    field.style.marginTop = `${(laid - content) * layout.vertical}px`;
    field.style.height = `${content}px`;
    const own = field.getBoundingClientRect();
    const host = field.offsetParent?.getBoundingClientRect() ?? own;
    barAt = { left: own.left - host.left, top: own.top - host.top - BAR_GAP_PX };
  }

  const focused = () => !!field && document.activeElement === field;

  function measureRange(): Box | null {
    const host = field?.offsetParent;
    if (!field?.firstChild || !host || sel.start === sel.end) {
      return null;
    }
    const own = rangeOf(field, sel).getBoundingClientRect();
    const origin = host.getBoundingClientRect();
    return { left: own.left - origin.left, top: own.top - origin.top, width: own.width, height: own.height };
  }

  function paint() {
    if (!field) {
      return;
    }
    field.innerHTML = body(value, textRange.runs, textRange.lists);
    if (focused()) {
      select(field, sel);
    }
    fit();
    rangeBox = measureRange();
  }

  $effect(() => {
    void style;
    fit();
  });

  $effect(() => {
    void value;
    void textRange.runs;
    void textRange.lists;
    paint();
  });

  function end() {
    if (ended) {
      return;
    }
    ended = true;
    const { runs, lists } = textRange;
    textRange.close();
    oncommit(value, runs, lists);
  }

  let bar = $state<HTMLDivElement>();

  const kept = (target: EventTarget | null) => target instanceof Element && ((bar?.contains(target) ?? false) || (field?.contains(target) ?? false) || target.closest(PANEL) !== null);

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
    if (!field) {
      return;
    }
    field.focus();
    select(field, sel);
  }

  function syncRange() {
    textRange.select({ start: codeIndex(value, sel.start), end: codeIndex(value, sel.end) });
  }

  function selected() {
    const now = field ? selectionIn(field) : null;
    if (!now) {
      return;
    }
    sel = now;
    syncRange();
    rangeBox = measureRange();
  }

  const snapshot = (): Snapshot => ({ text: value, runs: textRange.runs, lists: textRange.lists, sel });

  function record() {
    past.push(snapshot());
    past.splice(0, past.length - HISTORY_LIMIT);
    future.length = 0;
  }

  function restore(from: Snapshot[], to: Snapshot[]) {
    const back = from.pop();
    if (!back) {
      return;
    }
    to.push(snapshot());
    sel = back.sel;
    textRange.text = back.text;
    textRange.runs = back.runs;
    textRange.lists = back.lists;
    value = back.text;
    syncRange();
  }

  function write(next: string, caret: number) {
    sel = { start: caret, end: caret };
    value = next;
    textRange.retype(next);
    syncRange();
  }

  function insert(typed: string) {
    record();
    const plain = typed.replaceAll('\r\n', NEWLINE).replaceAll('\r', NEWLINE);
    write(value.slice(0, sel.start) + plain + value.slice(sel.end), sel.start + plain.length);
  }

  function readBack() {
    if (!field) {
      return;
    }
    const next = textOf(field);
    sel = selectionIn(field) ?? sel;
    if (next === value) {
      paint();
      return;
    }
    write(next, sel.start);
  }

  const dropped = (e: InputEvent) => insert(e.dataTransfer?.getData('text/plain') ?? '');

  const OWN_INPUT: Record<string, (e: InputEvent) => void> = {
    insertParagraph: () => insert(NEWLINE),
    insertLineBreak: () => insert(NEWLINE),
    insertFromPaste: dropped,
    insertFromDrop: dropped,
    historyUndo: () => restore(past, future),
    historyRedo: () => restore(future, past)
  };

  function beforeInput(e: InputEvent) {
    const own = OWN_INPUT[e.inputType];
    if (own) {
      e.preventDefault();
      own(e);
      return;
    }
    if (e.inputType.startsWith('format')) {
      e.preventDefault();
      return;
    }
    if (!composing) {
      record();
    }
  }

  function pasted(e: ClipboardEvent) {
    e.preventDefault();
    insert(e.clipboardData?.getData('text/plain') ?? '');
  }

  function typed() {
    if (composing) {
      return;
    }
    readBack();
  }

  function restyle(edit: RunEdit) {
    record();
    textRange.restyle(edit);
  }

  async function openLink() {
    selected();
    linkOpen = true;
    await tick();
    linkField?.focus();
  }

  function applyLink() {
    if (!linkOpen) {
      return;
    }
    linkOpen = false;
    const link = linkOf(linkField?.value ?? '');
    if (link !== undefined) {
      restyle({ link });
    }
    refocus();
  }

  function onLinkKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyLink();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      linkOpen = false;
      refocus();
    }
  }

  const LIST_SHORTCUTS: Record<string, ListKind> = { Digit7: ListKind.Number, Digit8: ListKind.Bullet };

  const atParagraphStart = () => sel.start === sel.end && (sel.start === 0 || value[sel.start - 1] === NEWLINE);

  const emptyParagraph = () => atParagraphStart() && (value[sel.start] ?? NEWLINE) === NEWLINE;

  function onListKey(e: KeyboardEvent): boolean {
    const listKind = (e.metaKey || e.ctrlKey) && e.shiftKey ? LIST_SHORTCUTS[e.code] : undefined;
    if (listKind) {
      selected();
      record();
      textRange.setList(listKind);
      return true;
    }
    selected();
    if (e.key === 'Tab' && textRange.listed) {
      record();
      textRange.indent(e.shiftKey ? -1 : 1);
      return true;
    }
    if ((e.key === 'Enter' && emptyParagraph() && textRange.listed) || (e.key === 'Backspace' && atParagraphStart() && textRange.listed)) {
      record();
      textRange.unlist();
      return true;
    }
    return false;
  }

  function onHistoryKey(e: KeyboardEvent): boolean {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') {
      return false;
    }
    if (e.shiftKey) {
      restore(future, past);
      return true;
    }
    restore(past, future);
    return true;
  }

  function onKey(e: KeyboardEvent) {
    if (!composing && onHistoryKey(e)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (styled && e.shiftKey && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'u') {
      e.preventDefault();
      e.stopPropagation();
      void openLink();
      return;
    }
    if (styled && !composing && onListKey(e)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
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

  function compositionStarted() {
    composing = true;
    record();
  }

  function compositionEnded() {
    composing = false;
    readBack();
  }

  onMount(() => {
    value = text;
    textRange.open({ clipId: styled ? clipId : '', text, runs: initialRuns, lists: initialLists, base });
    window.addEventListener('pointerdown', outside, true);
    const follow = () => focused() && !composing && selected();
    document.addEventListener('selectionchange', follow);
    void tick().then(() => {
      sel = { start: 0, end: value.length };
      field?.focus();
      paint();
      syncRange();
    });
    return () => {
      window.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('selectionchange', follow);
    };
  });
</script>

<div
  bind:this={field}
  class="edit"
  data-testid="core-text-edit"
  {style}
  role="textbox"
  aria-multiline="true"
  tabindex="0"
  contenteditable="true"
  spellcheck="false"
  onbeforeinput={beforeInput}
  oninput={typed}
  onpaste={pasted}
  onkeydown={onKey}
  onkeyup={selected}
  onpointerup={selected}
  oncompositionstart={compositionStarted}
  oncompositionend={compositionEnded}
  onblur={left}
  onpointerdown={(e) => e.stopPropagation()}
  ondblclick={(e) => e.stopPropagation()}
></div>

{#if rangeBox && textRange.values?.fill && textRange.values.fill !== MIXED}
  <div data-text-range-panel style="display:contents">
    <GradientHandles rect={rangeBox} fill={textRange.values.fill} onchange={(f) => restyle({ fill: f as GradientFill })} ondone={(f) => restyle({ fill: f as GradientFill })} />
  </div>
{/if}

{#if styled && picked.start !== picked.end}
  <div bind:this={bar} class="range" data-testid="text-range-bar" role="toolbar" tabindex="-1" style="left:{barAt.left}px;top:{barAt.top}px" onmousedown={(e) => e.target instanceof HTMLButtonElement && e.preventDefault()} onpointerdown={(e) => e.stopPropagation()}>
    <button type="button" data-testid="text-range-bold" title="Bold (⌘B)" onclick={() => restyle({ weight: RunToggle.Bold })}><b>B</b></button>
    <button type="button" data-testid="text-range-italic" title="Italic (⌘I)" onclick={() => restyle({ italic: RunToggle.Italic })}><i>I</i></button>
    <input type="color" data-testid="text-range-colour" title="Colour" bind:value={tint} onchange={() => {
        restyle({ color: tint, fill: null });
        refocus();
      }} />
    <button type="button" data-testid="text-range-link" title="Link (⇧⌘U)" onclick={openLink}>Link</button>
    {#if linkOpen}
      <input bind:this={linkField} type="url" class="url" data-testid="text-range-url" placeholder="https://" value={textRange.values?.link === MIXED ? '' : (textRange.values?.link ?? '')} onkeydown={onLinkKey} onblur={applyLink} />
    {/if}
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
    min-width: 24px;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text, #111);
    cursor: pointer;
  }

  .range [data-testid='text-range-link'] {
    width: auto;
    padding: 0 6px;
  }

  .range .url {
    width: 160px;
    padding: 0 6px;
    border: 1px solid var(--ui-border, rgb(0 0 0 / 0.15));
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
    overflow: hidden;
    pointer-events: auto;
  }
</style>
