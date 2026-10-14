// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FRAME_TAP, frameTapScript, listenTap } from './frame-tap';

function stage() {
  const lift = document.createElement('div');
  const frame = document.createElement('iframe');
  lift.appendChild(frame);
  document.body.replaceChildren(lift);
  return { lift, frame };
}

const tap = (source: Window | null, x = 0.25, y = 0.75) => dispatchEvent(new MessageEvent('message', { source, data: { type: FRAME_TAP, x, y } }));

const activation = (isActive: boolean) => Object.defineProperty(navigator, 'userActivation', { value: { isActive }, configurable: true });

describe('a tap on the playing preview', () => {
  beforeEach(() => activation(true));

  it('lets the press reach the frame while listening, and gives it back when disposed', () => {
    const { lift, frame } = stage();

    const stop = listenTap(frame, lift, () => {});

    expect(frame.style.pointerEvents).toBe('auto');
    expect(lift.style.zIndex).not.toBe('');

    stop();

    expect(frame.style.pointerEvents).toBe('');
    expect(lift.style.zIndex).toBe('');
  });

  it('reports where the frame was tapped, as a fraction of it', () => {
    const { lift, frame } = stage();
    const ontap = vi.fn();
    listenTap(frame, lift, ontap);

    tap(frame.contentWindow);

    expect(ontap).toHaveBeenCalledWith({ x: 0.25, y: 0.75 });
  });

  it('keeps a forged point inside the frame', () => {
    const { lift, frame } = stage();
    const ontap = vi.fn();
    listenTap(frame, lift, ontap);

    tap(frame.contentWindow, 9, -3);

    expect(ontap).toHaveBeenCalledWith({ x: 1, y: 0 });
  });

  it('refuses a tap the frame posts without a real user gesture', () => {
    activation(false);
    const { lift, frame } = stage();
    const ontap = vi.fn();
    listenTap(frame, lift, ontap);

    tap(frame.contentWindow);

    expect(ontap).not.toHaveBeenCalled();
  });

  it('ignores any window but the frame', () => {
    const { lift, frame } = stage();
    const ontap = vi.fn();
    listenTap(frame, lift, ontap);

    tap(window);

    expect(ontap).not.toHaveBeenCalled();
  });

  it('stops listening when disposed', () => {
    const { lift, frame } = stage();
    const ontap = vi.fn();
    listenTap(frame, lift, ontap)();

    tap(frame.contentWindow);

    expect(ontap).not.toHaveBeenCalled();
  });
});

describe('the script inside the preview', () => {
  it('posts each press as a fraction of the frame', () => {
    const post = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 200, configurable: true });
    new Function(frameTapScript().replace(/^<script>|<\/script>$/g, ''))();

    dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, clientY: 50 }));

    expect(post).toHaveBeenCalledWith({ type: FRAME_TAP, x: 0.25, y: 0.25 }, '*');
  });
});
