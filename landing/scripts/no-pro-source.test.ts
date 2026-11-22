import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findProSource, proMarks } from './no-pro-source.mjs';

function outputWith(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'pro-source-'));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}

describe('the build output check', () => {
  it('marks every pro item by its source class', () => {
    expect(proMarks()).toContain('fl-parallax-gallery');
  });

  it('finds a pro source class in any built file', () => {
    const dir = outputWith({ 'client/a.js': 'x', 'server/chunks/b.js': '.fl-parallax-gallery{}' });
    expect(findProSource(dir, ['fl-parallax-gallery'])).toEqual([join(dir, 'server/chunks/b.js')]);
  });

  it('passes when the item is only named, as in its page url', () => {
    const dir = outputWith({ 'templates/parallax-gallery.html': '<a href="/templates/parallax-gallery">' });
    expect(findProSource(dir, ['fl-parallax-gallery'])).toEqual([]);
  });
});
