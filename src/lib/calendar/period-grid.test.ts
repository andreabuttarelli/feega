import { describe, expect, it } from 'vitest';
import { CalendarView, periodGrid, shiftAnchor, plannedInstant, dayKeyOf, gridDayKey, periodTitle, placedInstant } from './period-grid';

const TODAY = new Date('2026-09-29T08:00:00Z');

describe('periodGrid', () => {
  it('la settimana è una riga da lunedì a domenica che contiene l’ancora', () => {
    const weeks = periodGrid(CalendarView.Week, '2026-10-01', TODAY);

    expect(weeks).toHaveLength(1);
    expect(weeks[0].map(gridDayKey)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04'
    ]);
    expect(weeks[0].every((d) => !d.outside)).toBe(true);
    expect(weeks[0][1].isToday).toBe(true);
  });

  it('il mese è la stessa griglia della pagina Calendario', () => {
    const weeks = periodGrid(CalendarView.Month, '2026-11-20', TODAY);

    expect(weeks[0][6]).toMatchObject({ year: 2026, month: 11, day: 1, outside: false });
    expect(weeks.flat().filter((d) => !d.outside)).toHaveLength(30);
  });
});

describe('shiftAnchor', () => {
  it('una settimana avanti sono sette giorni, anche a cavallo d’anno', () => {
    expect(shiftAnchor(CalendarView.Week, '2026-12-29', 1)).toBe('2027-01-05');
  });

  it('un mese indietro va al primo del mese prima', () => {
    expect(shiftAnchor(CalendarView.Month, '2026-03-31', -1)).toBe('2026-02-01');
  });
});

describe('plannedInstant', () => {
  it('un giorno senza orario precedente cade alle 10 locali', () => {
    expect(plannedInstant('2026-10-02', 'Europe/Rome', null)).toBe('2026-10-02T08:00:00.000Z');
  });

  it('spostare un post tiene la sua ora locale', () => {
    const before = '2026-10-02T16:30:00.000Z';
    expect(plannedInstant('2026-10-05', 'Europe/Rome', before)).toBe('2026-10-05T16:30:00.000Z');
  });

  it('attraverso il cambio d’ora resta la stessa ora locale', () => {
    const before = '2026-10-23T16:30:00.000Z';
    expect(plannedInstant('2026-10-26', 'Europe/Rome', before)).toBe('2026-10-26T17:30:00.000Z');
  });
});

describe('periodTitle', () => {
  it('la settimana dice il lunedì, il mese dice mese e anno', () => {
    expect(periodTitle(CalendarView.Week, '2026-10-01')).toBe('Week of Sep 28, 2026');
    expect(periodTitle(CalendarView.Month, '2026-10-01')).toBe('October 2026');
  });
});

describe('placedInstant', () => {
  it('una consegna programmata vince sulla data pianificata', () => {
    expect(placedInstant({ plannedFor: '2026-10-02T08:00:00Z', deliveries: [{ scheduledFor: '2026-10-03T08:00:00Z' }] })).toBe('2026-10-03T08:00:00Z');
  });

  it('una bozza sta dove è pianificata, o fuori dalla griglia', () => {
    expect(placedInstant({ plannedFor: '2026-10-02T08:00:00Z', deliveries: [] })).toBe('2026-10-02T08:00:00Z');
    expect(placedInstant({ plannedFor: null, deliveries: [] })).toBeNull();
  });
});

describe('dayKeyOf', () => {
  it('il giorno è quello del fuso di chi guarda', () => {
    expect(dayKeyOf('2026-10-02T23:30:00Z', 'Europe/Rome')).toBe('2026-10-03');
    expect(dayKeyOf('2026-10-02T23:30:00Z', 'UTC')).toBe('2026-10-02');
  });
});
