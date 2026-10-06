import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { changelogEntries } from './changelog';

const PUBLIC_PAGES = ['TERMS.md', 'ACCEPTABLE-USE.md', 'PRIVACY.md', 'AI-TRANSPARENCY.md', 'SUBPROCESSORS.md'];
const INTERNAL_NAMES = /uncensored|nsfw/i;

describe('public texts never name the age-restricted features internally', () => {
  it.each(PUBLIC_PAGES)('%s', (page) => {
    expect(readFileSync(page, 'utf8')).not.toMatch(INTERNAL_NAMES);
  });

  it('public changelog', () => {
    expect(JSON.stringify(changelogEntries)).not.toMatch(INTERNAL_NAMES);
  });
});
