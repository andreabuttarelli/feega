import { describe, expect, it } from 'vitest';
import { wireInputs } from './wire-inputs';

const NO_MEDIA = { prompt: 'p', params: {}, imageUrls: [], lastFrameUrl: null };

describe('wireInputs', () => {
  it('sends upstream videos and audios as lists, each capped by the model', () => {
    const shape = { fields: { prompt: 'prompt', images: [], imageList: 'image_urls', videoList: 'video_urls', audioList: 'audio_urls' }, caps: { video: 1, audio: 2 } };
    const inputs = wireInputs(shape, { ...NO_MEDIA, imageUrls: ['i1'], videoUrls: ['v1', 'v2'], audioUrls: ['a1', 'a2', 'a3'] }, {});
    expect(inputs).toEqual({ prompt: 'p', image_urls: ['i1'], video_urls: ['v1'], audio_urls: ['a1', 'a2'] });
  });

  it('caps the image list by the model too', () => {
    const shape = { fields: { prompt: 'prompt', images: [], imageList: 'image_urls' }, caps: { image: 1 } };
    expect(wireInputs(shape, { ...NO_MEDIA, imageUrls: ['i1', 'i2'] }, {})).toEqual({ prompt: 'p', image_urls: ['i1'] });
  });

  it('sends the first upstream video to a single video field', () => {
    const inputs = wireInputs({ fields: { prompt: 'prompt', images: [], video: 'video_url' } }, { ...NO_MEDIA, videoUrls: ['v1', 'v2'] }, {});
    expect(inputs).toEqual({ prompt: 'p', video_url: 'v1' });
  });

  it('leaves list fields out when nothing upstream fills them', () => {
    const inputs = wireInputs({ fields: { prompt: 'prompt', images: [], videoList: 'video_urls' } }, NO_MEDIA, {});
    expect(inputs).toEqual({ prompt: 'p' });
  });
});
