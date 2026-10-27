import { describe, expect, it } from 'vitest';
import { isLottieFile } from './lottie-file';

describe('isLottieFile', () => {
  it('takes .json and .lottie files', () => {
    expect(isLottieFile({ name: 'spin.json' })).toBe(true);
    expect(isLottieFile({ name: 'Spin.LOTTIE' })).toBe(true);
  });

  it('leaves everything else to the other importers', () => {
    expect(isLottieFile({ name: 'logo.svg' })).toBe(false);
    expect(isLottieFile({ name: 'board.feega' })).toBe(false);
    expect(isLottieFile({ name: 'json' })).toBe(false);
  });
});
