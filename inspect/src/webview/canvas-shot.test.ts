import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAPTURED } from '../messages';
import { FULL_SHOT_TIMEOUT_MS, SHOT_TIMEOUT_MS, fullShotOf, shotOf } from './canvas-shot';

const ORIGIN = 'http://localhost:5173';

function setup() {
  const target = new EventTarget();
  vi.stubGlobal('window', target);
  vi.stubGlobal('location', { origin: ORIGIN });
  const posted: { id: number }[] = [];
  const frame = { src: `${ORIGIN}/about`, contentWindow: { postMessage: (m: { id: number }) => posted.push(m) } } as unknown as HTMLIFrameElement;
  const reply = (data: unknown, source: unknown = frame.contentWindow) => target.dispatchEvent(Object.assign(new Event('message'), { data, origin: ORIGIN, source }));

  return { frame, posted, reply };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('shotOf', () => {
  it('asks one frame for its tab and resolves with a data url', async () => {
    const { frame, posted, reply } = setup();
    const shot = shotOf(frame);

    expect(posted[0]).toMatchObject({ type: 'feega:capture' });
    reply({ type: CAPTURED, id: posted[0].id, png: 'iVBORw0K' });

    expect(await shot).toBe('data:image/png;base64,iVBORw0K');
  });

  it('ignores a picture that another frame answered', async () => {
    vi.useFakeTimers();
    const { frame, posted, reply } = setup();
    const shot = shotOf(frame);

    reply({ type: CAPTURED, id: posted[0].id, png: 'other' }, {});
    vi.advanceTimersByTime(SHOT_TIMEOUT_MS);

    expect(await shot).toBeNull();
  });

  it('gives up when the frame never answers', async () => {
    vi.useFakeTimers();
    const { frame } = setup();
    const shot = shotOf(frame);

    vi.advanceTimersByTime(SHOT_TIMEOUT_MS);

    expect(await shot).toBeNull();
  });

  it('gives null when the page failed to draw', async () => {
    const { frame, posted, reply } = setup();
    const shot = shotOf(frame);

    reply({ type: CAPTURED, id: posted[0].id, error: 'tainted' });

    expect(await shot).toBeNull();
  });

  it('gives null for a frame without a window', async () => {
    setup();

    expect(await shotOf({ src: '', contentWindow: null } as unknown as HTMLIFrameElement)).toBeNull();
  });
});

describe('fullShotOf', () => {
  const ASK = { scale: 0.5, maxHeight: 15000 };

  it('asks for the whole document at the scale and cap it was given', () => {
    const { frame, posted } = setup();

    void fullShotOf(frame, ASK);

    expect(posted[0]).toMatchObject({ type: 'feega:capture', full: true, scale: 0.5, maxHeight: 15000 });
  });

  it('resolves with the picture and the height of the document', async () => {
    const { frame, posted, reply } = setup();
    const shot = fullShotOf(frame, ASK);

    reply({ type: CAPTURED, id: posted[0].id, png: 'iVBORw0K', height: 4200, capped: false });

    expect(await shot).toEqual({ snap: { url: 'data:image/png;base64,iVBORw0K', height: 4200, capped: false } });
  });

  it('says why the page could not be drawn', async () => {
    const { frame, posted, reply } = setup();
    const shot = fullShotOf(frame, ASK);

    reply({ type: CAPTURED, id: posted[0].id, error: 'tainted canvas' });

    expect(await shot).toEqual({ reason: 'tainted canvas' });
  });

  it('says the bridge never answered', async () => {
    vi.useFakeTimers();
    const { frame } = setup();
    const shot = fullShotOf(frame, ASK);

    vi.advanceTimersByTime(FULL_SHOT_TIMEOUT_MS);

    expect(await shot).toEqual({ reason: 'the page did not answer the capture' });
  });

  it('says there is no frame to ask', async () => {
    setup();

    expect(await fullShotOf({ src: '', contentWindow: null } as unknown as HTMLIFrameElement, ASK)).toEqual({ reason: 'the frame has no window' });
  });
});
