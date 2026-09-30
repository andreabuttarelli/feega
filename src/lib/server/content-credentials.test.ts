import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';

const env = vi.hoisted((): Record<string, string | undefined> => ({}));
vi.mock('$env/dynamic/private', () => ({ env }));
import { DIGITAL_SOURCE_TYPE, markGenerated, signC2pa, syntheticXmp } from './content-credentials';

const NO_MODEL = { model: null, provider: null };
const SYNTHETIC_IRI = `http://cv.iptc.org/newscodes/digitalsourcetype/${DIGITAL_SOURCE_TYPE.synthetic}`;

const makePng = () => sharp({ create: { width: 32, height: 32, channels: 3, background: '#204080' } }).png().toBuffer();
const makeJpeg = () => sharp({ create: { width: 32, height: 32, channels: 3, background: '#a03050' } }).jpeg({ quality: 92 }).toBuffer();

async function c2paInstalled(): Promise<boolean> {
  try {
    await import(/* @vite-ignore */ 'c2pa-node');
    return true;
  } catch {
    return false;
  }
}

describe('syntheticXmp', () => {
  it('carries the IPTC DigitalSourceType term as a resolvable IRI inside a well-formed packet', () => {
    const xmp = syntheticXmp(DIGITAL_SOURCE_TYPE.synthetic);
    expect(xmp).toContain(`<Iptc4xmpExt:DigitalSourceType>${SYNTHETIC_IRI}</Iptc4xmpExt:DigitalSourceType>`);
    expect(xmp.startsWith('<?xpacket begin=')).toBe(true);
    expect(xmp.endsWith('<?xpacket end="w"?>')).toBe(true);
  });

  it('distinguishes wholly generated media from composites', () => {
    expect(syntheticXmp(DIGITAL_SOURCE_TYPE.composite)).toContain('compositeWithTrainedAlgorithmicMedia');
  });

  it('omits AISystemUsed when the model is unknown', () => {
    expect(syntheticXmp(DIGITAL_SOURCE_TYPE.synthetic, NO_MODEL)).not.toContain('AISystemUsed');
  });
});

describe('the container is edited, not re-encoded', () => {
  it('a marked PNG keeps IEND last', async () => {
    const { bytes } = await markGenerated(await makePng(), 'image/png', NO_MODEL);
    expect(bytes.subarray(bytes.length - 8, bytes.length - 4).toString('latin1')).toBe('IEND');
  });

  it('a marked JPEG grows by exactly one APP1 segment', async () => {
    const jpeg = await makeJpeg();
    const { bytes } = await markGenerated(jpeg, 'image/jpeg', NO_MODEL);
    const app1Header = 4;
    const namespace = 'http://ns.adobe.com/xap/1.0/\0'.length;
    expect(bytes.length).toBe(jpeg.length + app1Header + namespace + Buffer.byteLength(syntheticXmp(DIGITAL_SOURCE_TYPE.synthetic, NO_MODEL)));
  });
});

describe('signC2pa', () => {
  it('is a no-op until signing is configured', async () => {
    delete env.C2PA_SIGNING;
    const jpeg = await makeJpeg();
    await expect(signC2pa(jpeg, 'image/jpeg', SYNTHETIC_IRI)).resolves.toBe(jpeg);
  });

  it('with signing on but the package absent, returns the bytes untouched', async () => {
    if (await c2paInstalled()) {
      return;
    }
    env.C2PA_SIGNING = 'on';
    try {
      const jpeg = await makeJpeg();
      await expect(signC2pa(jpeg, 'image/jpeg', SYNTHETIC_IRI)).resolves.toBe(jpeg);
    } finally {
      delete env.C2PA_SIGNING;
    }
  });

  it('the XMP marking lands whether or not signing is on', async () => {
    for (const signing of [undefined, 'on']) {
      env.C2PA_SIGNING = signing;
      const out = await markGenerated(await makeJpeg(), 'image/jpeg', { ...NO_MODEL, sourceType: DIGITAL_SOURCE_TYPE.composite });
      expect(out.marked).toBe(true);
      expect((await sharp(out.bytes).metadata()).xmp?.toString()).toContain('compositeWithTrainedAlgorithmicMedia');
    }
    delete env.C2PA_SIGNING;
  });
});
