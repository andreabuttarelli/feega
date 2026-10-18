import { js } from './html';
import { CLIP_TEXT } from '../poster-parts';

export enum EditEnd {
  Commit = 'commit',
  Cancel = 'cancel'
}

export const TEXT_EDIT = {
  start: 'feega:text-edit',
  stop: 'feega:text-edit-stop',
  input: 'feega:text-input',
  end: 'feega:text-edited',
  commit: EditEnd.Commit,
  cancel: EditEnd.Cancel
} as const;

type Names = typeof TEXT_EDIT;

export type TextEditStart = { type: Names['start']; id: string; selector: string; x?: number; y?: number };

export type TextEditMessage = { type: Names['input']; id: string; text: string } | { type: Names['end']; id: string; text: string; end: EditEnd };

const quoted = (s: string) => s.replace(/["\\]/g, '\\$&');

export function textTarget(clipId: string, part: string): string {
  const layer = `[data-clip="${quoted(clipId)}"]`;
  return part === CLIP_TEXT ? `${layer} [id="tx-${quoted(clipId)}"]` : `${layer} [data-part="${quoted(part)}"]`;
}

export function installTextEdit(win: Window, doc: Document, send: (message: unknown) => void, names: Names): () => void {
  let editing: HTMLElement | null = null;
  let session = '';
  let watcher: MutationObserver | null = null;

  const textOf = (el: HTMLElement) => (el.innerText ?? el.textContent ?? '').replace(/\n$/, '');

  const finish = () => {
    const el = editing;
    if (!el) {
      return;
    }
    editing = null;
    watcher?.disconnect();
    watcher = null;
    el.removeAttribute('contenteditable');
    el.removeEventListener('input', onInput);
    el.removeEventListener('keydown', onKey, true);
    el.removeEventListener('blur', finish);
    send({ type: names.end, id: session, text: textOf(el), end: names.commit });
    el.blur();
    if (win.parent !== win) {
      win.parent.focus();
    }
  };

  const onInput = () => {
    if (editing) {
      send({ type: names.input, id: session, text: textOf(editing) });
    }
  };

  const onKey = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.isComposing) {
      return;
    }
    if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      finish();
    }
  };

  const caretAt = (el: HTMLElement, x?: number, y?: number) => {
    const selection = win.getSelection?.();
    if (!selection) {
      return;
    }
    const point = typeof x === 'number' && typeof y === 'number' && doc.caretRangeFromPoint ? doc.caretRangeFromPoint(x * win.innerWidth, y * win.innerHeight) : null;
    const range = point && el.contains(point.startContainer) ? point : doc.createRange();
    if (range !== point) {
      range.selectNodeContents(el);
    }
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const start = (m: TextEditStart) => {
    finish();
    session = m.id;
    const el = doc.querySelector<HTMLElement>(m.selector);
    if (!el) {
      send({ type: names.end, id: session, text: '', end: names.cancel });
      return;
    }
    editing = el;
    el.setAttribute('contenteditable', 'plaintext-only');
    if (el.contentEditable !== 'plaintext-only') {
      el.setAttribute('contenteditable', 'true');
    }
    el.style.outline = 'none';
    el.style.cursor = 'text';
    el.addEventListener('input', onInput);
    el.addEventListener('keydown', onKey, true);
    el.addEventListener('blur', finish);
    el.focus();
    caretAt(el, m.x, m.y);
    watcher = new MutationObserver(() => {
      if (editing && !editing.isConnected) {
        finish();
      }
    });
    watcher.observe(doc.body, { childList: true, subtree: true });
  };

  const onMessage = (e: MessageEvent) => {
    const m = e.data;
    if (m && m.type === names.start) {
      start(m);
    }
    if (m && m.type === names.stop) {
      finish();
    }
  };

  win.addEventListener('message', onMessage);
  return () => {
    finish();
    win.removeEventListener('message', onMessage);
  };
}

export function textEditScript(): string {
  return `<script>(${installTextEdit.toString()})(window,document,function(m){parent.postMessage(m,'*');},${js(TEXT_EDIT)});</script>`;
}
