import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { claimPort, turnSettled } from './drive';

const user = { role: 'user' };
const assistant = { role: 'assistant' };

describe('when the driver may stop waiting for the agent', () => {
  const idle = { running: false, messages: [user, assistant] };

  it('not on the first idle look: the brief sends Go by itself 8 s later (the app case reloaded over that Go turn and exported 15 s of black)', () => {
    expect(turnSettled(null, idle)).toBe(false);
  });

  it('not when a message arrived between two idle looks', () => {
    expect(turnSettled(idle, { running: false, messages: [user, assistant, user, assistant] })).toBe(false);
  });

  it('not while the agent runs or the last word is the user\'s', () => {
    expect(turnSettled({ running: true, messages: [user] }, { running: true, messages: [user] })).toBe(false);
    expect(turnSettled({ running: false, messages: [user, assistant, user] }, { running: false, messages: [user, assistant, user] })).toBe(false);
  });

  it('once two idle looks in a row see the same thread', () => {
    expect(turnSettled(idle, { running: false, messages: [user, assistant] })).toBe(true);
  });
});

describe('one eval per port', () => {
  const dir = () => mkdtempSync(join(tmpdir(), 'eval-lock-'));

  it('refuses a port another live eval holds', () => {
    const at = dir();
    claimPort(5199, at, () => true);

    expect(() => claimPort(5199, at, () => true)).toThrow(/5199/);
  });

  it('takes over a lock whose eval died, and releases it at the end', () => {
    const at = dir();
    claimPort(5199, at, () => true);

    const release = claimPort(5199, at, () => false);
    release();

    expect(existsSync(join(at, 'feega-eval-motion-5199.lock'))).toBe(false);
  });

  it('two ports never collide', () => {
    const at = dir();
    claimPort(5199, at, () => true);

    expect(() => claimPort(5200, at, () => true)).not.toThrow();
  });
});
