export const CAPTURE = 'feega:capture';
export const CAPTURED = 'feega:captured';

const PNG_PREFIX = 'data:image/png;base64,';
const PAPER = '#ffffff';
const TRANSPARENT = new Set(['', 'transparent', 'rgba(0, 0, 0, 0)']);

export const loadRenderer = async () => (await import('./capture-lib.js')).domToPng;

const backdropOf = (win) => {
  const doc = win.document;
  const painted = [doc.body, doc.documentElement].map((node) => win.getComputedStyle(node).backgroundColor).find((colour) => !TRANSPARENT.has(colour));
  return painted ?? PAPER;
};

const tabOptions = (win) => ({
  width: win.innerWidth,
  height: win.innerHeight,
  backgroundColor: backdropOf(win),
  style: { transform: `translate(${-win.scrollX}px, ${-win.scrollY}px)`, transformOrigin: 'top left' }
});

const selected = (doc, { selector, index }) => {
  if (typeof selector !== 'string') {
    return null;
  }
  const found = doc.querySelectorAll(selector);
  return found[index ?? 0] ?? found[0] ?? null;
};

export async function captureTab(win, request, render) {
  const doc = win.document;
  const element = selected(doc, request);
  const options = element ? {} : tabOptions(win);
  const url = await render(element ?? doc.documentElement, options);
  return url.startsWith(PNG_PREFIX) ? url.slice(PNG_PREFIX.length) : url;
}

export async function captureFull(win, request, render) {
  const doc = win.document;
  await doc.fonts?.ready;
  const document = doc.documentElement.scrollHeight;
  const height = Math.min(document, request.maxHeight);
  const url = await render(doc.documentElement, { width: win.innerWidth, height, scale: request.scale, backgroundColor: backdropOf(win) });

  return { png: url.startsWith(PNG_PREFIX) ? url.slice(PNG_PREFIX.length) : url, height, capped: document > height };
}
