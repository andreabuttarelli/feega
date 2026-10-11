import { describe, expect, it } from 'vitest';
import { FontClass, Imagery, SmallText, referenceLookSchema } from './reference-look-model';

const look = { typeScale: 0.3, bleed: false, columns: 2, smallText: SmallText.Some, palette: ['#111111'], font: FontClass.Grotesk, imagery: Imagery.Photo };

describe('reference look', () => {
  it('records the pacing of video references: seconds per shot and how they cut', () => {
    const parsed = referenceLookSchema.parse({ ...look, pacing: { shotSeconds: 1.5, cuts: 'hard cuts on the beat, whip pans between products' } });

    expect(parsed.pacing).toEqual({ shotSeconds: 1.5, cuts: 'hard cuts on the beat, whip pans between products' });
  });

  it('refuses a shot length no video has', () => {
    expect(referenceLookSchema.safeParse({ ...look, pacing: { shotSeconds: 0 } }).success).toBe(false);
  });
});
