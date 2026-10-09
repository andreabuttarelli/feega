import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAPTURE_REPLY, FrameFormat, captureScript, type CaptureReply, type CaptureRequest } from './capture';
import { Playback, RELOAD_DEBOUNCE_MS, previewDriver, type PlayerPort } from './preview-driver';

const REQUEST = { format: FrameFormat.Jpeg, width: 64, height: 36 };
const COMMIT_MS = 30;

const page = (name: string) => `<html><body data-name="${name}">${name}</body>${captureScript({ width: 64, height: 36 }, name, "lib.js")}</html>`;
const nameOf = (html: string) => /data-name="([^"]+)"/.exec(html)?.[1] ?? '';

function slowPlayer(first: string, stuck = '') {
  let committed = first;
  const ready = new Set<() => void>();
  const replies = new Set<(r: CaptureReply) => void>();
  const stampOf = (html: string) => /"stamp":"([^"]+)"/.exec(html)?.[1];

  const port: PlayerPort = {
    load: (html) => {
      if (nameOf(html) === stuck) {
        return;
      }
      queueMicrotask(() => ready.forEach((l) => l()));
      setTimeout(() => {
        committed = html;
        ready.forEach((l) => l());
      }, COMMIT_MS);
    },
    seek: () => {},
    play: () => {},
    pause: () => {},
    post: (m) => {
      const doc = committed;
      const id = (m as CaptureRequest).id;
      queueMicrotask(() => replies.forEach((l) => l({ type: CAPTURE_REPLY, id, url: nameOf(doc), stamp: stampOf(doc) })));
      return true;
    },
    onReady: (l) => (ready.add(l), () => ready.delete(l)),
    onReply: (l) => (replies.add(l), () => replies.delete(l))
  };
  return port;
}

describe('the preview driver', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('captures the document it was asked to load, not the one a stale ready left behind', async () => {
    const driver = previewDriver(slowPlayer(page('trailer-v2')));

    await driver.loaded(page('ugc'));
    const reply = await driver.shoot(0, REQUEST);

    expect(reply.url).toBe('ugc');
  });

  it('a frame that never draws fails after the wait it was given, naming the moment and the wait', async () => {
    vi.useFakeTimers();
    const silent: PlayerPort = { ...slowPlayer(page('a')), post: () => true };
    const driver = previewDriver(silent);
    const outcome = driver.shoot(1.5, REQUEST, 40_000).then(
      () => 'drawn',
      (e: Error) => e.message
    );

    await vi.advanceTimersByTimeAsync(39_000);
    const early = await Promise.race([outcome, Promise.resolve('waiting')]);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(early).toBe('waiting');
    expect(await outcome).toBe('the frame at 1.50s did not draw within 40s');
  });

  it('runs borrowed captures one after the other', async () => {
    const driver = previewDriver(slowPlayer(page('editor')));
    const order: string[] = [];
    const job = (name: string) =>
      driver.exclusive(async () => {
        await driver.loaded(page(name));
        order.push(`start ${name}`);
        order.push(`${name}:${(await driver.shoot(0, REQUEST)).url}`);
      });

    await Promise.all([job('export'), job('agent')]);

    expect(order).toEqual(['start export', 'export:export', 'start agent', 'agent:agent']);
  });
});

describe('agent looks during one turn', () => {
  const SHORT_MS = 200;

  it('a document that never becomes ready fails its own look, and every later look is still answered', async () => {
    const driver = previewDriver(slowPlayer(page('editor'), 'stuck'), () => crypto.randomUUID(), SHORT_MS);
    const look = (name: string) =>
      driver.exclusive(async () => {
        try {
          await driver.loaded(page(name));
          return (await driver.shoot(0, REQUEST)).url;
        } finally {
          await driver.loaded(page('editor'));
        }
      });

    const first = await look('one');
    await new Promise((r) => setTimeout(r, COMMIT_MS * 2));
    const overlapping = await Promise.allSettled([look('stuck'), look('three'), look('four')]);
    const fifth = await look('five');

    expect(first).toBe('one');
    expect(overlapping.map((r) => (r.status === 'fulfilled' ? r.value : 'failed'))).toEqual(['failed', 'three', 'four']);
    expect(fifth).toBe('five');
  });
});

describe('editing the previewed document', () => {
  const doc = (text: string, seconds = 2) => `<html><head></head><body><div id="root" data-duration="${seconds}"><!--hot--><p>${text}</p><!--/hot--></div><script data-hot>tl.set(${seconds})</script></body></html>`;

  it('a change inside #root and the timeline is patched in place, not reloaded', () => {
    const { port, calls } = transport();
    const driver = previewDriver(port);
    driver.load(doc('a'));
    driver.ready();

    driver.update(doc('b'));

    expect(calls).toEqual(['load', 'pause', 'post:feega:hot']);
  });

  it('a change outside reloads the page', () => {
    const { port, calls } = transport();
    const driver = previewDriver(port);
    driver.load(doc('a'));
    driver.ready();

    vi.useFakeTimers();
    driver.update(doc('a', 3));
    vi.advanceTimersByTime(RELOAD_DEBOUNCE_MS);
    vi.useRealTimers();

    expect(calls).toEqual(['load', 'pause', 'load']);
  });

  it('before the player is ready, an edit reloads', () => {
    const { port, calls } = transport();
    const driver = previewDriver(port);
    driver.load(doc('a'));

    vi.useFakeTimers();
    driver.update(doc('b'));
    vi.advanceTimersByTime(RELOAD_DEBOUNCE_MS);
    vi.useRealTimers();

    expect(calls).toEqual(['load', 'load']);
  });
});

function transport() {
  const calls: string[] = [];
  const port: PlayerPort = {
    load: () => calls.push('load'),
    seek: () => {},
    post: (m) => (calls.push(`post:${m.type}`), true),
    play: () => calls.push('play'),
    pause: () => calls.push('pause'),
    onReady: () => () => {},
    onReply: () => () => {}
  };
  return { port, calls };
}

describe('the preview transport', () => {
  it('a Play pressed before the player is ready starts it once ready', () => {
    const { port, calls } = transport();
    const driver = previewDriver(port);

    driver.playback(Playback.Playing);
    driver.ready();

    expect(calls).toEqual(['play']);
  });

  it('Play and Pause reach the player once it is ready', () => {
    const { port, calls } = transport();
    const driver = previewDriver(port);
    driver.ready();

    driver.playback(Playback.Playing);
    driver.playback(Playback.Paused);

    expect(calls).toEqual(['pause', 'play', 'pause']);
  });

  it('a reload keeps playing once the new document is ready', () => {
    const { port, calls } = transport();
    const driver = previewDriver(port);
    driver.ready();
    driver.playback(Playback.Playing);

    driver.load('<html></html>');
    driver.ready();

    expect(calls).toEqual(['pause', 'play', 'load', 'play']);
  });
});
