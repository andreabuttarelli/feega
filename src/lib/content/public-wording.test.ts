import { describe, expect, it } from 'vitest';
import { changelogEntries } from './changelog';

const INTERNAL_NAMES = /uncensored|nsfw/i;

describe('public texts never name the age-restricted features internally', () => {
  it('public changelog', () => {
    expect(JSON.stringify(changelogEntries)).not.toMatch(INTERNAL_NAMES);
  });
});
