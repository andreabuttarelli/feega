import { describe, expect, it } from 'vitest';
import { uploadName } from './asset-name';

describe('the name an uploaded file shows', () => {
  it('is the file name, without the upload id in front', () => {
    expect(uploadName('org/project/3f2c1a9e-1b2c-4d5e-8f90-123456789abc-hero shot.png')).toBe('hero shot.png');
  });

  it('a plain path keeps its last segment', () => {
    expect(uploadName('org/project/logo.svg')).toBe('logo.svg');
  });

  it('no path, no name', () => {
    expect(uploadName(null)).toBe('');
  });
});
