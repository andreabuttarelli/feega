import { describe, it, expect, vi, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

vi.mock('$env/dynamic/private', () => ({ env: {} }));
import { DIGITAL_SOURCE_TYPE, MARKING_STRATEGY, markGenerated, type Provenance } from './content-credentials';
import { ensureFfmpegPath } from './ffmpeg-bin';

const PROVENANCE: Provenance = { model: 'google/gemini-2.5-flash-image', provider: 'openrouter' };
const IPTC_TERM = 'trainedAlgorithmicMedia';

let ffmpeg: string;
let dir: string;

beforeAll(async () => {
  const bin = await ensureFfmpegPath();
  if (!bin) {
    throw new Error('ffmpeg missing: the container strategies cannot be verified');
  }
  ffmpeg = bin;
  dir = await mkdtemp(path.join(os.tmpdir(), 'cc-marking-'));
});

async function fixture(name: string, args: string[]): Promise<Buffer> {
  const file = path.join(dir, name);
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', ...args, file]);
  return readFile(file);
}

async function containerTags(name: string, bytes: Buffer): Promise<string> {
  const file = path.join(dir, `read-${name}`);
  await writeFile(file, bytes);
  return execFileSync(ffmpeg, ['-loglevel', 'error', '-i', file, '-f', 'ffmetadata', '-'], { encoding: 'utf8' });
}

const image = (format: 'png' | 'jpeg' | 'webp') =>
  sharp({ create: { width: 24, height: 16, channels: 3, background: '#336699' } })[format]().toBuffer();

describe('the marking table', () => {
  it('names a strategy for every media type feega generates', () => {
    expect(Object.keys(MARKING_STRATEGY).sort()).toEqual(
      [
        'audio/mp3',
        'audio/mpeg',
        'audio/wav',
        'audio/wave',
        'audio/x-wav',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'video/webm'
      ].sort()
    );
  });
});

describe('images carry IPTC/XMP with the model and feega as generator', () => {
  for (const format of ['png', 'jpeg', 'webp'] as const) {
    it(`${format}`, async () => {
      const original = await image(format);
      const out = await markGenerated(original, `image/${format}`, PROVENANCE);

      expect(out.marked).toBe(true);
      const meta = await sharp(out.bytes).metadata();
      const xmp = meta.xmp?.toString() ?? '';
      expect(xmp).toContain(IPTC_TERM);
      expect(xmp).toContain('<Iptc4xmpExt:AISystemUsed>openrouter/google/gemini-2.5-flash-image</Iptc4xmpExt:AISystemUsed>');
      expect(xmp).toContain('<xmp:CreatorTool>feega</xmp:CreatorTool>');
      expect(xmp).toContain('photoshop:Credit');
      expect(meta.format).toBe(format === 'jpeg' ? 'jpeg' : format);
      expect(Buffer.compare(await sharp(original).raw().toBuffer(), await sharp(out.bytes).raw().toBuffer())).toBe(0);
    });
  }

  it('escapes a model id that would break the XML', async () => {
    const out = await markGenerated(await image('png'), 'image/png', { model: 'a<b>&"c', provider: null });
    expect((await sharp(out.bytes).metadata()).xmp?.toString()).toContain('a&lt;b&gt;&amp;&quot;c');
  });
});

describe('video and audio carry container tags', () => {
  const cases = [
    { mime: 'video/mp4', name: 'v.mp4', args: ['-f', 'lavfi', '-i', 'color=c=blue:s=32x32:d=1', '-pix_fmt', 'yuv420p'] },
    { mime: 'video/quicktime', name: 'v.mov', args: ['-f', 'lavfi', '-i', 'color=c=red:s=32x32:d=1', '-pix_fmt', 'yuv420p'] },
    { mime: 'video/webm', name: 'v.webm', args: ['-f', 'lavfi', '-i', 'color=c=green:s=32x32:d=1', '-c:v', 'libvpx-vp9'] },
    { mime: 'audio/mpeg', name: 'a.mp3', args: ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=1'] },
    { mime: 'audio/wav', name: 'a.wav', args: ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=1'] }
  ];

  for (const c of cases) {
    it(c.mime, async () => {
      const original = await fixture(c.name, c.args);
      const out = await markGenerated(original, c.mime, { model: 'eleven_v3', provider: 'elevenlabs' });

      expect(out.marked).toBe(true);
      const tags = await containerTags(c.name, out.bytes);
      expect(tags).toContain('AI-generated');
      expect(tags).toContain(IPTC_TERM);
      expect(tags).toContain('elevenlabs/eleven_v3');
      expect(tags).toContain('feega');
    });
  }

  it('an mp3 carries the claim in ID3 TXXX frames', async () => {
    const out = await markGenerated(await fixture('id3.mp3', cases[3].args), 'audio/mpeg', PROVENANCE);
    const head = out.bytes.subarray(0, 2048).toString('latin1');
    expect(head.startsWith('ID3')).toBe(true);
    expect(head).toContain('TXXX');
    expect(head).toContain('DigitalSourceType');
  });
});

describe('a failed marking never loses the asset', () => {
  it('bytes that do not match their declared type come back untouched and unmarked', async () => {
    const junk = Buffer.from('definitely not an mp4');
    const out = await markGenerated(junk, 'video/mp4', PROVENANCE);
    expect(out).toEqual({ bytes: junk, marked: false });
  });

  it('a type with no strategy comes back untouched and unmarked', async () => {
    const gif = Buffer.from('GIF89a....');
    await expect(markGenerated(gif, 'image/gif', PROVENANCE)).resolves.toEqual({ bytes: gif, marked: false });
  });

  it('a truncated png comes back untouched and unmarked', async () => {
    const truncated = (await image('png')).subarray(0, 20);
    await expect(markGenerated(truncated, 'image/png', PROVENANCE)).resolves.toEqual({ bytes: truncated, marked: false });
  });

  it('a composite keeps the composite term', async () => {
    const out = await markGenerated(await image('jpeg'), 'image/jpeg', { model: null, provider: null, sourceType: DIGITAL_SOURCE_TYPE.composite });
    expect((await sharp(out.bytes).metadata()).xmp?.toString()).toContain('compositeWithTrainedAlgorithmicMedia');
  });

  it('carries no personal data', async () => {
    const out = await markGenerated(await image('png'), 'image/png', PROVENANCE);
    expect((await sharp(out.bytes).metadata()).xmp?.toString()).not.toMatch(/@|user|prompt|brand/i);
  });
});
