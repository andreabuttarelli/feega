import { describe, expect, it } from 'vitest';
import { pickOf } from './live-fields';

const RESULT = {
  source: { file: 'app/Hero.tsx', line: 6, col: 7 },
  rect: { x: 10, y: 20, width: 300, height: 60 },
  styles: { color: 'rgb(0, 0, 0)', 'padding-left': '16px', 'font-weight': '600' },
  classes: 'text-5xl font-semibold text-black px-4',
  text: 'Ship faster'
};

describe('live fields', () => {
  it('una risposta del bridge diventa una selezione con file:line:col', () => {
    expect(pickOf(RESULT)?.source).toBe('app/Hero.tsx:6:7');
    expect(pickOf(null)).toBeNull();
  });
});
