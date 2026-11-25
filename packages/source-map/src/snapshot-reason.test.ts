import { describe, expect, it } from 'vitest';
import { Detail, Why, reasonOf } from './snapshot-reason.js';

describe('why a focus fell back to the snapshot', () => {
  it.each([
    ['useTheme must be used within a ThemeProvider', Why.MountError, Detail.Provider],
    ['Cannot read properties of null (reading useContext)', Why.MountError, Detail.Provider],
    ['The component is not exported', Why.MountError, Detail.NotExported],
    ['Failed to fetch dynamically imported module', Why.MountError, Detail.Load],
    ['x is not iterable', Why.MountError, Detail.Other],
    ['The bundle does not expose React', Why.Turbopack, undefined],
    ['It rendered nothing', Why.Timeout, undefined],
    ['The page did not render the component', Why.Timeout, undefined],
    ['The dev server has no mount page', Why.NoAdapter, undefined]
  ])('reads %s', (raw, why, detail) => {
    expect(reasonOf(raw)).toEqual(detail ? { reason: why, detail } : { reason: why });
  });

  it('never carries the message or a path', () => {
    expect(JSON.stringify(reasonOf('Error in /Users/me/app/src/Secret.tsx: boom'))).not.toContain('Secret');
  });

  it('keeps a code that is already one', () => {
    expect(reasonOf(Why.UnsupportedFramework)).toEqual({ reason: Why.UnsupportedFramework });
  });
});
