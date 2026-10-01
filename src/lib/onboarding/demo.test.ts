import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IMAGE_MODEL_CHOICES } from '$lib/image-models';
import { VIDEO_MODEL_CHOICES, videoModelSpec } from '$lib/video-models';
import { DEMO_PRESET, DEMO_RESULT, exampleFor } from './demo';

describe('example results are honest and shipped, the real run is cheap', () => {
  it('only a node flagged as example shows the shipped result', () => {
    expect(exampleFor({ type: 'image', data: { example: true } })?.src).toBe('/onboarding/example-image.webp');
    expect(exampleFor({ type: 'image', data: {} })).toBeNull();
    expect(exampleFor({ type: 'audio', data: { example: true } })).toBeNull();
  });

  it('every example asset exists as a static file', () => {
    for (const result of Object.values(DEMO_RESULT)) {
      if (result.src) {
        expect(existsSync(join(process.cwd(), 'static', result.src)), result.src).toBe(true);
      }
    }
  });

  it('the real run uses catalogue models, at the smallest video size', () => {
    expect(IMAGE_MODEL_CHOICES.map((c) => c.id)).toContain(DEMO_PRESET.image.model);
    expect(VIDEO_MODEL_CHOICES.map((c) => c.id)).toContain(DEMO_PRESET.video.model);
    expect(DEMO_PRESET.video.params?.duration).toBe(videoModelSpec(DEMO_PRESET.video.model)?.minDuration);
    expect(DEMO_PRESET.video.params?.resolution).toBe('480p');
  });
});
