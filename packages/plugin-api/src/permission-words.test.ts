import { describe, expect, it } from 'vitest';
import { Permission } from './manifest';
import { PERMISSION_WORDS, wordsOf } from './permission-words';

describe('permission words', () => {
  it('has a plain sentence for every permission', () => {
    for (const permission of Object.values(Permission)) {
      expect(PERMISSION_WORDS[permission].length).toBeGreaterThan(10);
    }
  });

  it('lists grants then the hosts the plugin may reach', () => {
    expect(wordsOf({ grants: [Permission.Selection], hosts: ['api.example.com'] })).toEqual([PERMISSION_WORDS[Permission.Selection], 'Send requests to api.example.com']);
  });

  it('says nothing for a plugin that asks for nothing', () => {
    expect(wordsOf({ grants: [], hosts: [] })).toEqual([]);
  });
});
