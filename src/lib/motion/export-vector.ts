import { esc } from './hyperframes/html';

export type Crop = { left: number; top: number; width: number; height: number };

export type PrintPage = { html: string; width: number; height: number };

export function printDocument(pages: readonly PrintPage[]): string {
  const sizes = pages.map((p, i) => `@page p${i} { size: ${p.width}px ${p.height}px; margin: 0 }`).join('\n');
  const sheets = pages.map((p, i) => `<iframe style="page: p${i}; width: ${p.width}px; height: ${p.height}px" srcdoc="${esc(p.html)}"></iframe>`).join('');
  return `<!doctype html><html><head><style>${sizes}\nhtml, body { margin: 0; padding: 0 }\niframe { display: block; border: 0; break-after: page }</style></head><body>${sheets}</body></html>`;
}
