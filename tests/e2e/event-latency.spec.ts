import { test, expect } from '@playwright/test';
import { presentedLatencies } from './fixtures/event-latency';

const begin = (local: string, ts: number) => ({ name: 'EventLatency', ph: 'b', id2: { local }, ts });
const end = (local: string, ts: number) => ({ name: 'EventLatency', ph: 'e', id2: { local }, ts });

test('una latenza va dall\'input al frame presentato, al microsecondo', () => {
  expect(presentedLatencies([begin('0x1', 1_000), end('0x1', 44_300)])).toEqual([43.3]);
});

test('un id riusato si accoppia con la fine che lo segue, non con la prima del trace', () => {
  const events = [begin('0x1', 1_000), end('0x1', 21_000), begin('0x1', 100_000), end('0x1', 151_500)];
  expect(presentedLatencies(events)).toEqual([20, 51.5]);
});

test('un input senza fine e gli altri eventi del trace non contano', () => {
  expect(presentedLatencies([begin('0x2', 0), { name: 'Other', ph: 'X', ts: 5 }])).toEqual([]);
});
