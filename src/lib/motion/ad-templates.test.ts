import { describe, expect, it } from 'vitest';
import { FPS } from './design';
import { FORMATS, clipsOf, formatOf, parseMotionDoc } from './doc';
import { TrackKind } from './components';
import { AD_TEMPLATES, AD_TEMPLATE_IDS, AdTemplate, templateAssets, type TemplateAssets } from './ad-templates';
import { AssetKind } from './components';
import { composeHtml } from './hyperframes/compose';
import { FEEGA_TOKENS } from './brand';

const FULL: TemplateAssets = { imageId: 'img', secondImageId: 'img2', videoId: 'vid', modelId: 'glb', musicId: 'mus', voiceId: 'vo' };
const NONE: TemplateAssets = { imageId: null, secondImageId: null, videoId: null, modelId: null, musicId: null, voiceId: null };

describe('ad templates', () => {
  for (const id of AD_TEMPLATE_IDS) {
    const spec = AD_TEMPLATES[id];

    it(`${spec.label} is a valid doc in its format, with or without assets`, () => {
      for (const assets of [FULL, NONE]) {
        const doc = spec.build(assets);
        const verdict = parseMotionDoc(doc);

        expect(verdict.ok, verdict.ok ? '' : verdict.error).toBe(true);
        expect(formatOf(doc)).toBe(spec.format);
        expect([doc.width, doc.height]).toEqual([FORMATS[spec.format].width, FORMATS[spec.format].height]);
      }
    });

    it(`${spec.label} lasts ${spec.seconds} s, inside the 15–30 s an ad needs`, () => {
      const doc = spec.build(FULL);

      expect(doc.durationInFrames).toBe(spec.seconds * FPS);
      expect(spec.seconds).toBeGreaterThanOrEqual(15);
      expect(spec.seconds).toBeLessThanOrEqual(30);
      expect(clipsOf(doc).every((c) => c.from + c.durationInFrames <= doc.durationInFrames)).toBe(true);
    });

    it(`${spec.label} composes, and names every track`, () => {
      const doc = spec.build(FULL);

      expect(composeHtml({ doc, tokens: FEEGA_TOKENS, assets: { img: '/i.png', img2: '/j.png', vid: '/v.mp4', glb: '/m.glb', mus: '/m.mp3', vo: '/vo.mp3' } })).toContain('data-composition-id');
      expect(doc.tracks.every((t) => t.name.length > 0)).toBe(true);
    });
  }

  it('every ad moves with keyframes, and most reveal with a mask', () => {
    const docs = AD_TEMPLATE_IDS.map((id) => AD_TEMPLATES[id].build(FULL));

    expect(docs.every((d) => clipsOf(d).some((c) => Object.keys(c.keyframes).length > 0))).toBe(true);
    expect(docs.filter((d) => clipsOf(d).some((c) => c.mask)).length).toBeGreaterThanOrEqual(4);
  });

  it('music and voice-over land on their own audio tracks when they exist', () => {
    const ugc = AD_TEMPLATES[AdTemplate.UgcVoiceover].build(FULL);
    const audio = ugc.tracks.filter((t) => t.kind === TrackKind.Audio);

    expect(audio.map((t) => t.name)).toEqual(['Voice-over', 'Music']);
    expect(audio.every((t) => t.clips.length === 1)).toBe(true);
    expect(AD_TEMPLATES[AdTemplate.UgcVoiceover].build(NONE).tracks.flatMap((t) => (t.kind === TrackKind.Audio ? t.clips : []))).toEqual([]);
  });

  it('the 3D launch turns the product model, or a 3D shape when there is none', () => {
    const with3d = clipsOf(AD_TEMPLATES[AdTemplate.Launch3D].build(FULL)).map((c) => c.component);
    const without = clipsOf(AD_TEMPLATES[AdTemplate.Launch3D].build(NONE)).map((c) => c.component);

    expect(with3d).toContain('Model3D');
    expect(without).toContain('Shape3D');
  });

  it('the longest audio is the music bed, the shortest other one the voice-over', () => {
    const picked = templateAssets([
      { id: 'vo', kind: AssetKind.Audio, seconds: 4 },
      { id: 'img', kind: AssetKind.Image },
      { id: 'bed', kind: AssetKind.Audio, seconds: 30 },
      { id: 'img2', kind: AssetKind.Image },
      { id: 'sting', kind: AssetKind.Audio, seconds: null }
    ]);

    expect(picked).toMatchObject({ imageId: 'img', secondImageId: 'img2', musicId: 'bed', voiceId: 'vo', videoId: null, modelId: null });
  });
});
