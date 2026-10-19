import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { HOSTED, Script } from '../libs/catalog';

const served = () => {
  const lib = HOSTED[Script.Screenshot];
  return readFileSync(createRequire(import.meta.url).resolve(`${lib.pkg}/${lib.source}`), 'utf8');
};

describe('video frames in an export', () => {
  it('are copied at the video size, so object-fit cover still crops them instead of stretching', () => {
    const source = served();

    expect(source).toContain('e.width=t.videoWidth,e.height=t.videoHeight');
    expect(source).not.toContain('e.width=t.clientWidth,e.height=t.clientHeight');
  });
});
