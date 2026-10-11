import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CutAnswer, Teardowns, asksUser, claimPort, cutAnswerFor, replyTo, turnSettled } from './drive';

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

describe('what the driver answers, as a real user would', () => {
  const account = { loginUrl: 'http://localhost:5399/login', email: 'e2e@feega.app', password: 'pw-1' };

  it('gives the test account when the agent asks for one: the feega eval refused it and the trailer showed the marketing page', () => {
    const reply = replyTo("Per mostrare l'app vera mi serve un account di test.", account);

    expect(reply).toContain('http://localhost:5399/login');
    expect(reply).toContain('e2e@feega.app');
    expect(reply).toContain('pw-1');
  });

  it('says it has none when the case has no account', () => {
    expect(replyTo('Hai un account di test?', null)).toMatch(/non ho un account/);
  });

  it('says yes to anything else', () => {
    expect(replyTo('Procedo con 20 s?', account)).toMatch(/vai pure/);
  });

  it('hears a request for an account even without a question mark, as the v5 agent wrote it', () => {
    expect(asksUser("Posso aprirla con lo stesso account di test e ricostruirla, se mi dai l'ok.")).toBe(true);
    expect(asksUser('Fatto: il trailer è pronto.')).toBe(false);
    expect(asksUser('Va bene così?')).toBe(true);
  });
});

describe('the cut review card', () => {
  it('applies the fixes once, then ships, so a second review never loops the run', () => {
    expect(cutAnswerFor(0)).toBe(CutAnswer.Apply);
    expect(cutAnswerFor(1)).toBe(CutAnswer.Ship);
    expect(cutAnswerFor(5)).toBe(CutAnswer.Ship);
  });
});

describe('teardown survives a driver crash', () => {
  it('runs every pending teardown once, even when one of them fails', async () => {
    const ran: string[] = [];
    const teardowns = new Teardowns();
    teardowns.add('a', async () => void ran.push('a'));
    teardowns.add('b', async () => Promise.reject(new Error('boom')));
    teardowns.add('c', async () => void ran.push('c'));

    const failed = await teardowns.runAll();
    await teardowns.runAll();

    expect(ran).toEqual(['a', 'c']);
    expect(failed).toEqual(['b']);
  });

  it('forgets a teardown that already ran in its finally', async () => {
    const ran: string[] = [];
    const teardowns = new Teardowns();
    const done = teardowns.add('a', async () => void ran.push('a'));
    await done();

    await teardowns.runAll();

    expect(ran).toEqual(['a']);
  });
});
