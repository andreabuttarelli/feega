import { describe, expect, it } from 'vitest';
import { CHANGELOG_PAGE_SIZE, changelogPage, changelogPageCount, changelogPagePath } from './changelog-pages';

const entries = Array.from({ length: CHANGELOG_PAGE_SIZE * 2 + 5 }, (_, i) => ({ date: '2026-11-18', title: `entry ${i}`, items: [] }));

describe('changelog pages', () => {
  it('ships only the newest page in the page itself', () => {
    expect(changelogPage(entries, 1).map((e) => e.title)).toEqual(entries.slice(0, CHANGELOG_PAGE_SIZE).map((e) => e.title));
  });

  it('serves the rest in later pages, the last one shorter', () => {
    expect(changelogPageCount(entries)).toBe(3);
    expect(changelogPage(entries, 3)).toHaveLength(5);
    expect(changelogPage(entries, 4)).toEqual([]);
  });

  it('names each later page by its number', () => {
    expect(changelogPagePath(2)).toBe('/changelog/page/2.json');
  });
});
