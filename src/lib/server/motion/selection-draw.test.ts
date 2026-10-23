// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { exportRowsSchema } from '$lib/motion/export-rows';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { addClip } from '$lib/motion/timeline';
import { displayListAt } from '$lib/motion/gpu-full/display-list';
import type { ExportPage, ExportPort, PageBox, Viewport } from './server-frames';
import { drawTargets } from './selection-draw';
import type { DrawTarget } from './selection-export';

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

const card = { shape: 'rect', x: 0.5, y: 0.5, width: 0.25, height: 0.25, fill: '#ff0000' };
const drawn = addClip(doc, { component: 'Shape', from: 0, durationInFrames: 90, props: card }, 'card');
const withCard = drawn.ok ? drawn.doc : doc;
const vector = async (target: DrawTarget) => ({ list: displayListAt(target.doc, 0, FEEGA_TOKENS), images: new Map<string, string>() });
const ports = (port: ExportPort) => ({ port, compose, vector });

describe('drawing an export', () => {
  it('a raster row is a screenshot at its scale, cropped to the element when one is asked', async () => {
    const { port, log } = fakePort();
    await drawTargets(ports(port), [{ nodeId: 'a', doc, elementId: 'title' }], row({ format: 'jpg', by: 'scale', value: 2, quality: 70 }));

    expect(log).toEqual([`open ${doc.width}x${doc.height}@2`, 'load', 'seek 0', 'shot image/jpeg 70 100,200,300,120', 'close']);
  });

  it('an SVG row is drawn from the display list: paths, no foreign object, no browser', async () => {
    const { port, log } = fakePort();
    const { bytes } = await drawTargets(ports(port), [{ nodeId: 'a', doc: withCard }], row({ format: 'svg', by: 'scale', value: 1 }));

    expect(bytes.toString()).toContain('<path');
    expect(bytes.toString()).not.toContain('foreignObject');
    expect(log).toEqual([]);
  });

  it('an SVG of one element is cropped to the box that element covers', async () => {
    const { port } = fakePort();
    const { bytes } = await drawTargets(ports(port), [{ nodeId: 'a', doc: withCard, elementId: 'card' }], row({ format: 'svg', by: 'scale', value: 2 }));

    expect(bytes.toString()).toContain(`viewBox="${doc.width * 0.375} ${doc.height * 0.375} ${doc.width * 0.25} ${doc.height * 0.25}"`);
  });

  it('an SVG row says what it could not draw', async () => {
    const { port } = fakePort();
    const blended = { ...withCard, tracks: withCard.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'card' ? { ...c, blend: 'multiply' } : c)) })) } as typeof withCard;
    const { skipped } = await drawTargets(ports(port), [{ nodeId: 'a', doc: blended }], row({ format: 'svg', by: 'scale', value: 1 }));

    expect(skipped).toEqual(['card: blend mode multiply']);
  });

  it('a PDF row prints every target as one page of one file', async () => {
    const { port, log } = fakePort();
    const { bytes } = await drawTargets(ports(port), [{ nodeId: 'a', doc: withCard }, { nodeId: 'b', doc: withCard, elementId: 'card' }], row({ format: 'pdf', by: 'scale', value: 1 }));

    expect(bytes.toString()).toBe('%PDF');
    expect(log.at(-1)).toBe('print 2');
  });
});
