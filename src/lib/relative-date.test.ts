import { describe, expect, it } from 'vitest';
import { relativeDate } from './relative-date';

const NOW = new Date('2026-10-09T12:00:00Z');

describe('a date said the way people say it', () => {
  it.each([
    ['2026-10-09T11:59:40Z', 'just now'],
    ['2026-10-09T11:15:00Z', '45 minutes ago'],
    ['2026-10-09T07:00:00Z', '5 hours ago'],
    ['2026-10-08T10:00:00Z', 'yesterday'],
    ['2026-10-04T12:00:00Z', '5 days ago'],
    ['2026-09-11T12:00:00Z', '4 weeks ago'],
    ['2026-03-01T12:00:00Z', '7 months ago'],
    ['2024-10-01T12:00:00Z', '2 years ago']
  ])('%s reads %s', (iso, said) => {
    expect(relativeDate(iso, NOW)).toBe(said);
  });
});
