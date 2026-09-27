import { describe, expect, it } from 'vitest';
import { monthGrid, placePosts } from './month-grid';

describe('monthGrid', () => {
  it('un mese che inizia di domenica porta 6 giorni fuori mese prima del primo', () => {
    const today = new Date('2026-11-15T12:00:00Z');
    const weeks = monthGrid(2026, 11, today);

    const firstWeek = weeks[0];
    expect(firstWeek).toHaveLength(7);
    expect(firstWeek.filter((d) => d.outside)).toHaveLength(6);
    expect(firstWeek[6]).toMatchObject({ year: 2026, month: 11, day: 1, outside: false });
  });

  it('febbraio bisestile porta il 29', () => {
    const today = new Date('2028-02-10T12:00:00Z');
    const weeks = monthGrid(2028, 2, today);

    const allDays = weeks.flat();
    const feb29 = allDays.find((d) => !d.outside && d.month === 2 && d.day === 29);

    expect(feb29).toBeDefined();
  });

  it('segna isToday solo sul giorno che corrisponde a `today`', () => {
    const today = new Date('2026-09-27T08:00:00Z');
    const weeks = monthGrid(2026, 9, today);

    const todays = weeks.flat().filter((d) => d.isToday);

    expect(todays).toHaveLength(1);
    expect(todays[0]).toMatchObject({ year: 2026, month: 9, day: 27 });
  });

  it('ogni settimana inizia di lunedi', () => {
    const today = new Date('2026-09-27T12:00:00Z');
    const weeks = monthGrid(2026, 9, today);

    for (const week of weeks) {
      expect(week[0].weekday).toBe(1);
      expect(week[6].weekday).toBe(0);
    }
  });

  it('i giorni finali fuori mese completano l ultima settimana', () => {
    const today = new Date('2026-09-27T12:00:00Z');
    const weeks = monthGrid(2026, 9, today);

    const lastWeek = weeks[weeks.length - 1];
    const trailing = lastWeek.filter((d) => d.outside && d.month !== 9);

    expect(trailing.length).toBeGreaterThan(0);
  });
});

describe('placePosts', () => {
  const today = new Date('2026-09-27T12:00:00Z');
  const grid = monthGrid(2026, 9, today);

  function post(id: string, scheduledFor: string | null) {
    return { id, scheduledFor };
  }

  it('un post con orario UTC che cade nel giorno locale successivo (Europe/Rome) finisce sul giorno giusto', () => {
    const posts = [post('p1', '2026-09-15T23:30:00Z')];

    const { byDay } = placePosts(posts, grid, 'Europe/Rome');

    expect(byDay['2026-09-16']).toEqual(['p1']);
    expect(byDay['2026-09-15']).toBeUndefined();
  });

  it('un post senza scheduledFor torna nei non programmati, non nella griglia', () => {
    const posts = [post('p1', null)];

    const { byDay, unscheduled } = placePosts(posts, grid, 'Europe/Rome');

    expect(byDay).toEqual({});
    expect(unscheduled).toEqual(['p1']);
  });

  it('piu post nello stesso giorno si accumulano nello stesso array', () => {
    const posts = [post('p1', '2026-09-10T08:00:00Z'), post('p2', '2026-09-10T18:00:00Z')];

    const { byDay } = placePosts(posts, grid, 'Europe/Rome');

    expect(byDay['2026-09-10']).toEqual(['p1', 'p2']);
  });
});
