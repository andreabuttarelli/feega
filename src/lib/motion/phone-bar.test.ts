import { describe, expect, it } from 'vitest';
import { BarItem, ON_PHONE, PhonePlace } from './phone-bar';

describe('the frame bar on a phone', () => {
  it('moves Publish, Export and Full screen into the overflow menu', () => {
    expect([BarItem.Publish, BarItem.Export, BarItem.FullScreen].map((i) => ON_PHONE[i])).toEqual([PhonePlace.More, PhonePlace.More, PhonePlace.More]);
  });

  it('drops version history on a phone', () => {
    expect(ON_PHONE[BarItem.History]).toBe(PhonePlace.Off);
  });
});
