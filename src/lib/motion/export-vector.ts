import { esc } from './hyperframes/html';

type Size = { width: number; height: number };

export type Crop = { left: number; top: number; width: number; height: number };

export function freezePage(doc: Document): string {
  for (const canvas of doc.querySelectorAll('canvas')) {
    const img = doc.createElement('img');
    try {
      img.src = canvas.toDataURL();
    } catch {
      continue;
    }
    img.style.cssText = canvas.style.cssText;
    img.width = canvas.width;
    img.height = canvas.height;
    img.className = canvas.className;
    canvas.replaceWith(img);
  }
  for (const script of doc.querySelectorAll('script')) {
    script.remove();
  }
  return new XMLSerializer().serializeToString(doc.documentElement);
}

export function svgDocument(xhtml: string, frame: Size, opts: { scale: number; crop?: Crop }): string {
  const box = opts.crop ?? { left: 0, top: 0, ...frame };
  const width = Math.round(box.width * opts.scale);
  const height = Math.round(box.height * opts.scale);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${box.left} ${box.top} ${box.width} ${box.height}"><foreignObject x="0" y="0" width="${frame.width}" height="${frame.height}">${xhtml}</foreignObject></svg>`;
}

export type PrintPage = { html: string; width: number; height: number };

export function printDocument(pages: readonly PrintPage[]): string {
  const sizes = pages.map((p, i) => `@page p${i} { size: ${p.width}px ${p.height}px; margin: 0 }`).join('\n');
  const sheets = pages.map((p, i) => `<iframe style="page: p${i}; width: ${p.width}px; height: ${p.height}px" srcdoc="${esc(p.html)}"></iframe>`).join('');
  return `<!doctype html><html><head><style>${sizes}\nhtml, body { margin: 0; padding: 0 }\niframe { display: block; border: 0; break-after: page }</style></head><body>${sheets}</body></html>`;
}
