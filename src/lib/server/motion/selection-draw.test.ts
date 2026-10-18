// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { exportRowsSchema } from '$lib/motion/export-rows';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import type { ExportPage, ExportPort, PageBox, Viewport } from './server-frames';
import { drawTargets } from './selection-draw';

const doc = newMotionDoc(MotionFormat.Square);
const ELEMENT_BOX: PageBox = { left: 100, top: 200, width: 300, height: 120 };

function fakePort() {
  const log: string[] = [];
  const port: ExportPort = {
    open: async (viewport: Viewport): Promise<ExportPage> => {
      log.push(`open ${viewport.width}x${viewport.height}@${viewport.scale}`);
      return {
        load: async () => void log.push('load'),
        seek: async (t) => void log.push(`seek ${t}`),
        jpeg: async () => Buffer.from(''),
        picture: async () => Buffer.from(''),
        close: async () => void log.push('close'),
        freeze: async () => '<html><body><p>Live text</p></body></html>',
        boxOf: async (id) => (id === 'title' ? ELEMENT_BOX : null),
        shot: async (mime, quality, clip) => {
          log.push(`shot ${mime} ${quality ?? '-'} ${clip ? `${clip.left},${clip.top},${clip.width},${clip.height}` : 'full'}`);
          return Buffer.from('png');
        }
      };
    },
    print: async (html) => {
      log.push(`print ${(html.match(/<iframe/g) ?? []).length}`);
      return Buffer.from('%PDF');
    }
  };
  return { port, log };
}

const compose = async () => '<html></html>';
const row = (raw: object) => exportRowsSchema.parse([raw])[0];

describe('drawing an export', () => {
  it('a raster row is a screenshot at its scale, cropped to the element when one is asked', async () => {
    const { port, log } = fakePort();
    await drawTargets(port, compose, [{ nodeId: 'a', doc, elementId: 'title' }], row({ format: 'jpg', by: 'scale', value: 2, quality: 70 }));

    expect(log).toEqual([`open ${doc.width}x${doc.height}@2`, 'load', 'seek 0', 'shot image/jpeg 70 100,200,300,120', 'close']);
  });

  it('an SVG row keeps the drawn text as text', async () => {
    const { port } = fakePort();
    const svg = (await drawTargets(port, compose, [{ nodeId: 'a', doc }], row({ format: 'svg', by: 'scale', value: 1 }))).toString();

    expect(svg).toContain('<foreignObject');
    expect(svg).toContain('Live text');
  });

  it('a PDF row prints every target as one page of one file', async () => {
    const { port, log } = fakePort();
    const pdf = await drawTargets(port, compose, [{ nodeId: 'a', doc }, { nodeId: 'b', doc, elementId: 'title' }], row({ format: 'pdf', by: 'scale', value: 1 }));

    expect(pdf.toString()).toBe('%PDF');
    expect(log.at(-1)).toBe('print 2');
  });
});
