import { describe, expect, it } from 'vitest';
import { MAX_VERSION_NAME, namesOf, withName } from './version-names';

describe('named versions', () => {
  it('names a version', () => {
    expect(withName({}, 4, '  Client review ')).toEqual({ '4': 'Client review' });
  });

  it('an empty name takes the name away', () => {
    expect(withName({ '4': 'Client review', '7': 'Final' }, 4, ' ')).toEqual({ '7': 'Final' });
  });

  it('cuts a long name', () => {
    expect(withName({}, 1, 'x'.repeat(200))['1']).toHaveLength(MAX_VERSION_NAME);
  });

  it('reads names stored on the frame, ignoring anything malformed', () => {
    expect(namesOf({ versionNames: { '3': 'A', '5': 9 } })).toEqual({ '3': 'A' });
    expect(namesOf({})).toEqual({});
  });
});
