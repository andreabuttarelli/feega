// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { EditEnd, TEXT_EDIT, installTextEdit, textEditScript, textTarget } from './text-edit';

type Sent = { type: string; text?: string; commit?: boolean };

let stopLast: (() => void) | null = null;

function stage() {
  document.body.innerHTML = '<div id="root"><div data-clip="tx"><div id="tx-tx" style="font-size:43px;color:#f0eee9"><span>Hello world</span></div></div><div data-clip="p"><span data-part="lines:1">Line</span></div></div>';
  const sent: Sent[] = [];
  const stop = installTextEdit(window, document, (m) => sent.push(m as Sent), TEXT_EDIT);
  stopLast = stop;
  return { sent, stop, start: (selector: string, id = 'e1') => window.dispatchEvent(new MessageEvent('message', { data: { type: TEXT_EDIT.start, selector, id } })) };
}

afterEach(() => {
  stopLast?.();
  document.body.innerHTML = '';
});

describe('editing a text where it is drawn', () => {
  it('makes the drawn element itself editable and focused, so it keeps its own style', () => {
    const { start } = stage();
    start(textTarget('tx', 'text'));
    const el = document.getElementById('tx-tx')!;
    expect(el.isContentEditable || el.getAttribute('contenteditable') !== null).toBe(true);
    expect(document.activeElement).toBe(el);
    expect(el.style.fontSize).toBe('43px');
  });

  it('reports every keystroke live and the final text when it ends', () => {
    const { start, sent } = stage();
    start(textTarget('tx', 'text'));
    const el = document.getElementById('tx-tx')!;
    el.textContent = 'Hello there';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(sent.find((m) => m.type === TEXT_EDIT.input)?.text).toBe('Hello there');
    expect(sent.at(-1)).toMatchObject({ type: TEXT_EDIT.end, text: 'Hello there', end: EditEnd.Commit });
    expect(el.getAttribute('contenteditable')).toBeNull();
  });

  it('Enter ends the edit, ⇧Enter breaks the line', () => {
    const { start, sent } = stage();
    start(textTarget('tx', 'text'));
    const el = document.getElementById('tx-tx')!;
    const shifted = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true });
    el.dispatchEvent(shifted);
    expect(sent.some((m) => m.type === TEXT_EDIT.end)).toBe(false);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(sent.at(-1)?.type).toBe(TEXT_EDIT.end);
  });

  it('ends with the last text when the frame redraws the edited element away', async () => {
    const { start, sent } = stage();
    start(textTarget('tx', 'text'));
    const el = document.getElementById('tx-tx')!;
    el.textContent = 'Typed';
    el.remove();
    await new Promise((r) => setTimeout(r, 0));
    expect(sent.at(-1)).toMatchObject({ type: TEXT_EDIT.end, text: 'Typed' });
  });

  it('tags every message with its edit, so a newer edit is not ended by an older one', () => {
    const { start, sent } = stage();
    start(textTarget('tx', 'text'), 'first');
    start(textTarget('tx', 'text'), 'second');
    expect(sent.find((m) => m.type === TEXT_EDIT.end)).toMatchObject({ id: 'first' });
    expect(document.getElementById('tx-tx')!.getAttribute('contenteditable')).not.toBeNull();
  });

  it('ends with the typed text when a click outside the frame takes the focus away', () => {
    const { start, sent } = stage();
    start(textTarget('tx', 'text'));
    document.getElementById('tx-tx')!.textContent = 'Outside';
    window.dispatchEvent(new Event('blur'));

    expect(sent.at(-1)).toMatchObject({ type: TEXT_EDIT.end, text: 'Outside', end: EditEnd.Commit });
  });

  it('finds a poster line by its part', () => {
    const { start } = stage();
    start(textTarget('p', 'lines:1'));
    expect(document.activeElement?.textContent).toBe('Line');
  });

  it('runs on its own inside the frame', () => {
    expect(textEditScript()).toContain('<script>');
    expect(() => new Function(textEditScript().replace(/<\/?script>/g, ''))).not.toThrow();
  });
});
