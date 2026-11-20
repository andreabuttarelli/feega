import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Source } from '../messages';
import { selectionSync } from './selection-sync';

const DELAY_MS = 150;
const home: Source = { file: 'src/home.ts', line: 3, col: 1 };
const nav: Source = { file: 'src/nav.ts', line: 9, col: 1 };

describe('selectionSync', () => {
  const revealed: Source[] = [];
  let on = true;
  const sync = () => selectionSync({ reveal: (at) => void revealed.push(at), enabled: () => on, delayMs: DELAY_MS });

  beforeEach(() => {
    vi.useFakeTimers();
    revealed.length = 0;
    on = true;
  });
  afterEach(() => vi.useRealTimers());

  it('rivela il sorgente dopo la pausa, non a ogni selezione', () => {
    const select = sync();
    select(home);
    select(nav);
    vi.advanceTimersByTime(DELAY_MS);

    expect(revealed).toEqual([nav]);
  });

  it('non riapre lo stesso elemento due volte', () => {
    const select = sync();
    select(home);
    vi.advanceTimersByTime(DELAY_MS);
    select(home);
    vi.advanceTimersByTime(DELAY_MS);

    expect(revealed).toEqual([home]);
  });

  it('con l\'impostazione spenta non rivela nulla', () => {
    on = false;
    sync()(home);
    vi.advanceTimersByTime(DELAY_MS);

    expect(revealed).toEqual([]);
  });

  it('deselezionare annulla la rivelazione in attesa', () => {
    const select = sync();
    select(home);
    select(null);
    vi.advanceTimersByTime(DELAY_MS);

    expect(revealed).toEqual([]);
  });
});
