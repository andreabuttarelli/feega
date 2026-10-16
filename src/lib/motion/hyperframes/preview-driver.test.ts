import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAPTURE_REPLY, CAPTURE_REQUEST, FrameFormat, captureScript, type CaptureReply, type CaptureRequest } from './capture';
import { EXACT_SEEK } from './exact-seek';
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

  it('an editor reload queued before a borrowed capture never lands in the middle of it', async () => {
    const driver = previewDriver(slowPlayer(page('editor')));
    await driver.loaded(page('editor'));
    driver.ready();

    driver.update(page('edited'));
    const urls = await driver.exclusive(async () => {
      await driver.loaded(page('check'));
      const shots: string[] = [];
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, RELOAD_DEBOUNCE_MS / 2));
        shots.push((await driver.shoot(0, REQUEST)).url ?? '');
      }
      return shots;
    });

    expect(urls).toEqual(Array(6).fill('check'));
  });

  it('a shot drawn at another time than asked, because something else moved the player, is taken again', async () => {
    let at = 0;
    let stray = true;
    const replies = new Set<(r: CaptureReply) => void>();
    const port: PlayerPort = {
      ...slowPlayer(page('a')),
      seek: (t) => (at = t),
      post: (m) => {
        const id = (m as CaptureRequest).id;
        if (stray) {
          stray = false;
          at = 0;
        }
        const drawn = at;
        queueMicrotask(() => replies.forEach((l) => l({ type: CAPTURE_REPLY, id, url: `frame@${drawn}`, time: drawn })));
        return true;
      },
      onReply: (l) => (replies.add(l), () => replies.delete(l))
    };
    const driver = previewDriver(port);

    const reply = await driver.shoot(0.77, REQUEST);

    expect(reply.url).toBe('frame@0.77');
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

  it('a seek while playing, as a poster capture does, keeps playing: the player pauses on every seek', async () => {
    const { port, calls } = transport();
    const replies = new Set<(r: CaptureReply) => void>();
    const driver = previewDriver({
      ...port,
      seek: () => calls.push('seek'),
      post: (m) => {
        if (m.type === CAPTURE_REQUEST) {
          queueMicrotask(() => replies.forEach((l) => l({ type: CAPTURE_REPLY, id: (m as CaptureRequest).id, url: 'x' })));
        }
        return true;
      },
      onReply: (l) => (replies.add(l), () => replies.delete(l))
    });
    driver.ready();
    driver.playback(Playback.Playing);

    await driver.shoot(1.2, REQUEST);
    driver.seek(0.2);

    expect(calls.at(-1)).toBe('play');
  });
});

describe('seeking the preview', () => {
  it('a seek moves the player, then asks the page for the exact time the player rounds away', () => {
    const { port, calls } = transport();
    const posted: unknown[] = [];
    const driver = previewDriver({ ...port, seek: (t) => calls.push(`seek:${t}`), post: (m) => (calls.push('post'), posted.push(m), true) });

    driver.seek(1 / 60);

    expect(calls).toEqual([`seek:${1 / 60}`, 'post']);
    expect(posted).toEqual([{ type: EXACT_SEEK, time: 1 / 60 }]);
  });

  it('a shot asks for the exact time before it is taken', async () => {
    const posted: string[] = [];
    const replies = new Set<(r: CaptureReply) => void>();
    const port: PlayerPort = {
      ...slowPlayer(page('a')),
      post: (m) => {
        posted.push(m.type);
        if (m.type === CAPTURE_REQUEST) {
          queueMicrotask(() => replies.forEach((l) => l({ type: CAPTURE_REPLY, id: (m as CaptureRequest).id, url: 'x' })));
        }
        return true;
      },
      onReply: (l) => (replies.add(l), () => replies.delete(l))
    };

    await previewDriver(port).shoot(1 / 60, REQUEST);

    expect(posted).toEqual([EXACT_SEEK, CAPTURE_REQUEST]);
  });

  it('a still asked before the player is ready waits for it instead of failing as not ready', async () => {
    let mounted = false;
    const base = slowPlayer(page('poster'));
    const port: PlayerPort = { ...base, post: (m) => mounted && base.post(m) };
    const driver = previewDriver(port);

    const shot = driver.whenLive().then(() => driver.shoot(0, REQUEST));
    await new Promise((r) => setTimeout(r, COMMIT_MS));
    mounted = true;
    driver.ready();

    expect((await shot).url).toBe('poster');
  });

  it('a still asked while an edit waits to reload pictures the edit, not the document before it', async () => {
    const driver = previewDriver(slowPlayer(page('first')));
    await driver.loaded(page('first'));
    driver.ready();

    driver.update(page('edited'));
    await driver.fresh(page('edited'));
    const reply = await driver.shoot(0, REQUEST);

    expect(reply.url).toBe('edited');
  });
});
