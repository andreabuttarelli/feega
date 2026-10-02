import { describe, it, expect, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

vi.mock('$env/dynamic/private', () => ({ env: {} }));
import { markGenerated, readGlbJson } from './content-credentials';

const GLB_MIME = 'model/gltf-binary';
const FIXTURE = path.join(import.meta.dirname, 'fixtures', 'triangle.glb');
const XMP_EXTENSION = 'KHR_xmp_json_ld';

describe('marking a GLB', () => {
  it('writes the AI claim as a KHR_xmp_json_ld packet bound to the asset', async () => {
    const glb = await readFile(FIXTURE);

    const out = await markGenerated(glb, GLB_MIME, { model: 'wiro/microsoft/trellis-2', provider: 'wiro' });

    expect(out.marked).toBe(true);
    const json = readGlbJson(out.bytes);
    expect(json.extensionsUsed).toContain(XMP_EXTENSION);
    const packet = json.extensions[XMP_EXTENSION].packets[json.asset.extensions[XMP_EXTENSION].packet];
    expect(packet['Iptc4xmpExt:DigitalSourceType']).toContain('trainedAlgorithmicMedia');
    expect(packet['Iptc4xmpExt:AISystemUsed']).toBe('wiro/wiro/microsoft/trellis-2');
    expect(json.asset.version).toBe('2.0');
  });

  it('keeps the binary chunk byte for byte and a valid header length', async () => {
    const glb = await readFile(FIXTURE);

    const { bytes } = await markGenerated(glb, GLB_MIME, { model: 'm', provider: 'wiro' });

    expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
    expect(bytes.readUInt32LE(8)).toBe(bytes.length);
    expect(bytes.subarray(bytes.length - 36).equals(glb.subarray(glb.length - 36))).toBe(true);
    const jsonLength = bytes.readUInt32LE(12);
    expect(jsonLength % 4).toBe(0);
  });

  it('stores unrecognised bytes unmarked', async () => {
    const out = await markGenerated(Buffer.from('not a glb at all'), GLB_MIME, { model: 'm', provider: 'wiro' });

    expect(out.marked).toBe(false);
  });
});
