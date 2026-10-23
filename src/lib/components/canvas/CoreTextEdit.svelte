<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { editCss, gradientSpans, type EditLayout, type TextEditStyle } from '$lib/canvas/frame-text-edit';
  import { textRange } from '$lib/canvas/text-range.svelte';
  import GradientHandles from './GradientHandles.svelte';
  import { ListKind, MARKER_GAP_EM, markersOf, type ListItem } from '$lib/motion/text-lists';
  import { codeIndex, linkOf, MIXED, RunToggle, STYLE_KEYS, type GradientFill, type RunEdit, type RunStyle, type TextRun } from '$lib/motion/text-runs';

  let { layout, look, text, clipId = '', base = {}, runs: initialRuns = [], lists: initialLists = [], styled = false, oncommit }: { layout: EditLayout; look: TextEditStyle; text: string; clipId?: string; base?: RunStyle; runs?: TextRun[]; lists?: ListItem[]; styled?: boolean; oncommit: (text: string, runs: TextRun[], lists: ListItem[]) => void } = $props();

  type Box = { left: number; top: number; width: number; height: number };

  let field = $state<HTMLTextAreaElement>();
  let rangeBox = $state<Box | null>(null);
  let value = $state('');
  let tint = $state('#000000');
  let mirrorStyle = $state('');
  let linkOpen = $state(false);
  let linkField = $state<HTMLInputElement>();

  const SHORTCUTS: Record<string, RunEdit> = { b: { weight: RunToggle.Bold }, i: { italic: RunToggle.Italic }, u: { underline: RunToggle.Underline } };
  const PANEL = '[data-text-range-panel]';
  const CLEARED: RunEdit = Object.fromEntries(STYLE_KEYS.map((k) => [k, null]));
  const picked = $derived(textRange.range);
  let composing = false;
  let ended = false;

  const style = $derived(editCss(look, layout));
  const spans = $derived(gradientSpans(value, textRange.runs));
  const markers = $derived(markersOf(textRange.lists));
  const paragraphs = $derived(value.split('\n'));
  const fieldStyle = $derived(spans.length ? `${style};color:transparent` : style);
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
    field.style.marginTop = `${(laid - content) * layout.vertical}px`;
    field.style.height = `${content}px`;
    const own = field.getBoundingClientRect();
    const host = field.offsetParent?.getBoundingClientRect() ?? own;
    barAt = { left: own.left - host.left, top: own.top - host.top - BAR_GAP_PX };
    mirrorStyle = field.style.cssText;
  }

  $effect(() => {
    void style;
    fit();
  });

  function measureRange(): Box | null {
    const host = field?.offsetParent;
    if (!field || !host || field.selectionStart === field.selectionEnd) {
      return null;
    }
    const mirror = document.createElement('div');
    mirror.style.cssText = field.style.cssText;
    Object.assign(mirror.style, { position: 'absolute', visibility: 'hidden', pointerEvents: 'none', height: 'auto', margin: field.style.marginTop ? `${field.style.marginTop} 0 0` : '0', overflowWrap: 'break-word' });
    const [before, within, after] = [value.slice(0, field.selectionStart), value.slice(field.selectionStart, field.selectionEnd), value.slice(field.selectionEnd)];
    const mark = document.createElement('span');
    mark.textContent = within;
    mirror.append(before, mark, after);
    host.append(mirror);
    const own = mark.getBoundingClientRect();
    const origin = host.getBoundingClientRect();
    mirror.remove();
    return { left: own.left - origin.left, top: own.top - origin.top, width: own.width, height: own.height };
  }

  $effect(() => {
    void style;
    void value;
    void picked;
    rangeBox = textRange.values?.fill && textRange.values.fill !== MIXED ? measureRange() : null;
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

  function atParagraphStart(): boolean {
    return field !== null && field !== undefined && field.selectionStart === field.selectionEnd && (field.selectionStart === 0 || value[field.selectionStart - 1] === '\n');
  }

  function emptyParagraph(): boolean {
    return atParagraphStart() && (value[field!.selectionStart] ?? '\n') === '\n';
  }

  function onListKey(e: KeyboardEvent): boolean {
    const listKind = (e.metaKey || e.ctrlKey) && e.shiftKey ? LIST_SHORTCUTS[e.code] : undefined;
    if (listKind) {
      selected();
      textRange.setList(listKind);
      return true;
    }
    selected();
    if (e.key === 'Tab' && textRange.listed) {
      textRange.indent(e.shiftKey ? -1 : 1);
      return true;
    }
    if ((e.key === 'Enter' && emptyParagraph() && textRange.listed) || (e.key === 'Backspace' && atParagraphStart() && textRange.listed)) {
      textRange.unlist();
      return true;
    }
    return false;
  }

  function onKey(e: KeyboardEvent) {
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

  onMount(() => {
    value = text;
    textRange.open({ clipId: styled ? clipId : '', text, runs: initialRuns, lists: initialLists, base });
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

{#if markers.some(Boolean)}
  <div class="edit mirror gutter" data-testid="core-text-markers" style="{mirrorStyle};color:transparent" aria-hidden="true">{#each paragraphs as paragraph, i (i)}{#if markers[i]}<span class="marker" style="color:{look.color};--gap:{MARKER_GAP_EM}em">{markers[i]}</span>{/if}{paragraph}{i < paragraphs.length - 1 ? '\n' : ''}{/each}</div>
{/if}

{#if spans.length}
  <div class="edit mirror" data-testid="core-text-paint" style="{mirrorStyle};color:transparent" aria-hidden="true">{#each spans as span, i (i)}<span style={span.style || `color:${look.color}`}>{span.text}</span>{/each}</div>
{/if}

<textarea
  bind:this={field}
  bind:value
  class="edit"
  data-testid="core-text-edit"
  style={fieldStyle}
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

  .mirror {
    outline: 0;
    pointer-events: none;
  }

  .edit.gutter {
    overflow: visible;
  }

  .marker {
    position: absolute;
    text-indent: 0;
    white-space: nowrap;
    transform: translateX(calc(-100% - var(--gap)));
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
