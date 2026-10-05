import { describe, expect, it } from 'vitest';
import { CAPTURE_REPLY, FrameFormat, captureScript, type CaptureReply, type CaptureRequest } from './capture';
import { Playback, previewDriver, type PlayerPort } from './preview-driver';

const REQUEST = { format: FrameFormat.Jpeg, width: 64, height: 36 };
const COMMIT_MS = 30;

const page = (name: string) => `<html><body data-name="${name}">${name}</body>${captureScript({ width: 64, height: 36 }, name)}</html>`;
const nameOf = (html: string) => /data-name="([^"]+)"/.exec(html)?.[1] ?? '';

function slowPlayer(first: string) {
  let committed = first;
  const ready = new Set<() => void>();
  const replies = new Set<(r: CaptureReply) => void>();
  const stampOf = (html: string) => /"stamp":"([^"]+)"/.exec(html)?.[1];

  const port: PlayerPort = {
    load: (html) => {
      queueMicrotask(() => ready.forEach((l) => l()));
      setTimeout(() => {
        committed = html;
        ready.forEach((l) => l());
      }, COMMIT_MS);
    },
    seek: () => {},
    play: () => {},
    pause: () => {},
    post: (m: CaptureRequest) => {
      const doc = committed;
      queueMicrotask(() => replies.forEach((l) => l({ type: CAPTURE_REPLY, id: m.id, url: nameOf(doc), stamp: stampOf(doc) })));
      return true;
    },
    onReady: (l) => (ready.add(l), () => ready.delete(l)),
    onReply: (l) => (replies.add(l), () => replies.delete(l))
  };
  return port;
}

describe('the preview driver', () => {
  it('captures the document it was asked to load, not the one a stale ready left behind', async () => {
    const driver = previewDriver(slowPlayer(page('trailer-v2')));

    await driver.loaded(page('ugc'));
    const reply = await driver.shoot(0, REQUEST);

    expect(reply.url).toBe('ugc');
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

function transport() {
  const calls: string[] = [];
  const port: PlayerPort = {
    load: () => calls.push('load'),
    seek: () => {},
    post: () => true,
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
