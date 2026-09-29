import { describe, expect, it, vi, afterEach } from 'vitest';
import { formatLastEdited } from './format-last-edited';

describe('formatLastEdited', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra solo l\'ora per una data di oggi', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-29T18:00:00'));
    const today = new Date('2026-09-29T14:20:00').toISOString();
    expect(formatLastEdited(today)).toMatch(/14:20|02:20/);
  });

  it('mostra giorno e mese per una data passata', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-29T18:00:00'));
    const past = new Date('2026-09-03T10:00:00').toISOString();
    expect(formatLastEdited(past)).toMatch(/3 Sep|Sep 3/);
  });
});
