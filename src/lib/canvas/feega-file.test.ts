import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { FEEGA_VERSION, FeegaRefusal, packFeega, remapIds, unpackFeega, type FeegaFile } from './feega-file';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const CANVAS = '22222222-2222-4222-8222-222222222222';
const FRAME = '33333333-3333-4333-8333-333333333333';
const IMAGE = '44444444-4444-4444-8444-444444444444';
const EDGE = '55555555-5555-4555-8555-555555555555';
const ASSET = '66666666-6666-4666-8666-666666666666';

const file: FeegaFile = {
  manifest: { format: 'feega', version: FEEGA_VERSION, exportedAt: '2026-10-25T00:00:00.000Z', canvasName: 'Launch', source: { projectId: PROJECT, canvasId: CANVAS } },
  canvas: {
    nodes: [
      { id: FRAME, type: 'motion', displayName: 'Hero', position: { x: 0, y: 0, z: 1 }, size: { width: 1080, height: 1080 }, data: { title: 'Hero' } },
      { id: IMAGE, type: 'image', displayName: null, position: { x: 1200, y: 0, z: 2 }, size: { width: null, height: null }, data: { assetId: ASSET, url: `/p/${PROJECT}/c/${CANVAS}/assets/${ASSET}`, parent: FRAME } }
    ],
    connections: [{ id: EDGE, sourceNodeId: IMAGE, targetNodeId: FRAME, sourceHandle: null, targetHandle: 'start', mode: 'fixed' }],
    heads: { [FRAME]: { version: 3, doc: { media: ASSET } } },
    assets: [{ id: ASSET, type: 'image', mimeType: 'image/png', width: 2, height: 2, durationS: null, content: null, url: null, file: 'assets/0-logo.png' }]
  }
};

const pixels = new Uint8Array([137, 80, 78, 71]);

describe('a .feega file', () => {
  it('carries a canvas and its files there and back unchanged', () => {
    const opened = unpackFeega(packFeega(file, new Map([['assets/0-logo.png', pixels]])));
    expect(opened).toEqual({ ok: true, file, blobs: new Map([['assets/0-logo.png', pixels]]) });
  });

  it('refuses bytes that are not a zip', () => {
    expect(unpackFeega(strToU8('not a zip'))).toEqual({ ok: false, refusal: FeegaRefusal.NotFeega });
  });

  it('refuses a zip without a manifest', () => {
    expect(unpackFeega(zipSync({ 'canvas.json': strToU8('{}') }))).toEqual({ ok: false, refusal: FeegaRefusal.NotFeega });
  });

  it('refuses a file written by a newer feega', () => {
    const newer = { ...file, manifest: { ...file.manifest, version: FEEGA_VERSION + 1 } };
    expect(unpackFeega(packFeega(newer, new Map([['assets/0-logo.png', pixels]])))).toEqual({ ok: false, refusal: FeegaRefusal.NewerVersion });
  });

  it('refuses a canvas that does not match the format', () => {
    const broken = zipSync({ 'manifest.json': strToU8(JSON.stringify(file.manifest)), 'canvas.json': strToU8('{"nodes":"no"}') });
    expect(unpackFeega(broken)).toEqual({ ok: false, refusal: FeegaRefusal.Damaged });
  });

  it('refuses a file whose listed asset is missing', () => {
    expect(unpackFeega(packFeega(file, new Map()))).toEqual({ ok: false, refusal: FeegaRefusal.Damaged });
  });

  it('gives every id its new value, wherever it is written', () => {
    const ids = new Map([
      [PROJECT, 'p'],
      [CANVAS, 'c'],
      [FRAME, 'f'],
      [IMAGE, 'i'],
      [EDGE, 'e'],
      [ASSET, 'a']
    ]);
    const moved = remapIds(file.canvas, ids);
    expect(moved.nodes.map((n) => n.id)).toEqual(['f', 'i']);
    expect(moved.nodes[1].data).toEqual({ assetId: 'a', url: '/p/p/c/c/assets/a', parent: 'f' });
    expect(moved.connections[0]).toMatchObject({ id: 'e', sourceNodeId: 'i', targetNodeId: 'f' });
    expect(moved.heads).toEqual({ f: { version: 3, doc: { media: 'a' } } });
  });
});
