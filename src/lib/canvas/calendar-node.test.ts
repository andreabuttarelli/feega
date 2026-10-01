import { describe, expect, it } from 'vitest';
import { CALENDAR_HINT_TEXT, calendarBrand, calendarData, calendarHint, CalendarHint, calendarOf, CalendarScope } from './calendar-node';
import { CalendarView } from '$lib/calendar/period-grid';
import { validateNodeData } from './node-data';
import { newNodeRow } from '$lib/canvas-node-data';

describe('un nodo calendar, letto dalla riga', () => {
  it('una riga vuota diventa una settimana sulla tela, ancorata a oggi', () => {
    const today = new Date(2026, 8, 29);

    expect(calendarOf({ id: 'c1', type: 'calendar', data: {} }, today)).toEqual({
      id: 'c1',
      view: CalendarView.Week,
      scope: CalendarScope.Canvas,
      brandId: null,
      anchor: '2026-09-29'
    });
  });

  it('rilegge quel che scrive', () => {
    const node = { id: 'c1', view: CalendarView.Month, scope: CalendarScope.Brand, brandId: 'b-1', anchor: '2026-10-01' };

    expect(calendarOf({ id: 'c1', type: 'calendar', data: calendarData(node) })).toEqual(node);
  });

  it('un altro tipo non è un calendario', () => {
    expect(calendarOf({ id: 'c1', type: 'image', data: {} })).toBeNull();
  });

  it('il nodo appena aggiunto passa la validazione del modello', () => {
    expect(validateNodeData('calendar', newNodeRow('calendar')).ok).toBe(true);
  });
});

describe('calendar brand and empty state', () => {
  const calendar = calendarOf({ id: 'c1', type: 'calendar', data: {} })!;

  it("defaults to the project's brand when the node has none", () => {
    expect(calendarBrand(calendar, 'brand-p')).toBe('brand-p');
    expect(calendarBrand({ ...calendar, brandId: 'brand-n' }, 'brand-p')).toBe('brand-n');
    expect(calendarBrand(calendar, null)).toBeNull();
  });

  it('without a brand, asks for one before anything else', () => {
    expect(calendarHint(null, [])).toBe(CalendarHint.PickBrand);
  });

  it('with a brand and no posts, explains how to plan', () => {
    expect(calendarHint('brand-1', [])).toBe(CalendarHint.Empty);
    expect(CALENDAR_HINT_TEXT[CalendarHint.Empty]).toBe('Connect or drop images, videos or text here to plan posts.');
  });

  it('with posts, or still loading, says nothing', () => {
    expect(calendarHint('brand-1', [{}])).toBeNull();
    expect(calendarHint('brand-1', null)).toBeNull();
  });
});
