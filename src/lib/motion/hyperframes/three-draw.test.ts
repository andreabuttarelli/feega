import { describe, expect, it } from 'vitest';
import { drawOnce, faceShown, quadMatrix, screenKey, screenPlacement } from './three-draw';

describe('drawOnce', () => {
  it('a seek repeated at the same time draws once: the producer seeks a frame several times', () => {
    const drawn: number[] = [];
    const draw = drawOnce((t) => drawn.push(t));

    draw.at(0.5);
    draw.at(0.5);
    draw.at(0.5);
    draw.at(0.6);

    expect(drawn).toEqual([0.5, 0.6]);
  });

  it('a video frame injected after the seek draws the same time again: the producer reseeks once it lands', () => {
    const drawn: number[] = [];
    let frame = 'f1';
    const draw = drawOnce((t) => drawn.push(t), () => frame);

    draw.at(0.5);
    frame = 'f2';
    draw.at(0.5);

    expect(drawn).toEqual([0.5, 0.5]);
  });

  it('a texture that lands late forces the same time to draw again', () => {
    const drawn: number[] = [];
    const draw = drawOnce((t) => drawn.push(t));

    draw.at(0.5);
    draw.again();

    expect(drawn).toEqual([0.5, 0.5]);
  });
});

describe('inlined into the page', () => {
  it('both run from their source alone, as the composed script embeds them', () => {
    const inlined = <T>(fn: T): T => new Function(`return (${String(fn)});`)() as T;
    const draw = inlined(drawOnce)(() => undefined, () => '');

    expect(() => draw.at(1)).not.toThrow();
    expect(inlined(screenKey)({ src: 'a', naturalWidth: 1 }, 0)).toBe(screenKey({ src: 'a', naturalWidth: 1 }, 0));
  });
});

describe('screenKey', () => {
  it('a still screenshot at the same scroll is the same screen, so its texture is not uploaded again', () => {
    const img = { src: 'https://x/a.jpg', naturalWidth: 10 };

    expect(screenKey(img, 0.2)).toBe(screenKey(img, 0.2));
    expect(screenKey(img, 0.3)).not.toBe(screenKey(img, 0.2));
  });

  it('a video frame is a new screen whenever the frame image or the video time moves', () => {
    expect(screenKey({ src: 'blob:f1', naturalWidth: 10 }, 0)).not.toBe(screenKey({ src: 'blob:f2', naturalWidth: 10 }, 0));
    expect(screenKey({ currentSrc: 'v.mp4', currentTime: 1, videoWidth: 10 }, 0)).not.toBe(screenKey({ currentSrc: 'v.mp4', currentTime: 1.04, videoWidth: 10 }, 0));
  });

  it('no source yet is its own key, so the first real frame always draws', () => {
    expect(screenKey(null, 0)).not.toBe(screenKey({ src: 'a', naturalWidth: 1 }, 0));
  });
});

describe('screenPlacement', () => {
  const PHONE = { width: 1206, height: 2622 };
  const NINE_SIXTEEN = { width: 1080, height: 1920 };

  it('cover fills the phone and crops a 9:16 source evenly on both sides', () => {
    const p = screenPlacement(NINE_SIXTEEN, PHONE, 'cover', 0, 0);

    expect(p.dx).toBe(0);
    expect(p.dw).toBe(PHONE.width);
    expect(p.sx).toBeCloseTo((NINE_SIXTEEN.width - p.sw) / 2, 6);
    expect(p.sh).toBeCloseTo(NINE_SIXTEEN.height, 6);
  });

  it('contain keeps the whole 9:16 source, centred with bars above and below', () => {
    const p = screenPlacement(NINE_SIXTEEN, PHONE, 'contain', 0, 0);

    expect([p.sx, p.sy, p.sw, p.sh]).toEqual([0, 0, NINE_SIXTEEN.width, NINE_SIXTEEN.height]);
    expect(p.dw).toBe(PHONE.width);
    expect(p.dh).toBeCloseTo((PHONE.width * 16) / 9, 6);
    expect(p.dy).toBeCloseTo((PHONE.height - p.dh) / 2, 6);
  });

  it('safe keeps the whole source below the cutout', () => {
    const safeTop = 0.05;
    const p = screenPlacement(NINE_SIXTEEN, PHONE, 'safe', 0, safeTop);

    expect(p.dy).toBeGreaterThanOrEqual(PHONE.height * safeTop - 1e-9);
    expect(p.dy + p.dh).toBeLessThanOrEqual(PHONE.height + 1e-9);
    expect([p.sw, p.sh]).toEqual([NINE_SIXTEEN.width, NINE_SIXTEEN.height]);
  });

  it('cover on a screenshot taller than the screen fits its width and scrolls', () => {
    const tall = { width: 1206, height: 6000 };

    expect(screenPlacement(tall, PHONE, 'cover', 0, 0).sy).toBe(0);
    expect(screenPlacement(tall, PHONE, 'cover', 1, 0).sy).toBeCloseTo(6000 - 2622, 6);
  });
});

describe('quadMatrix', () => {
  const apply = (m: number[], x: number, y: number) => {
    const w = m[3] * x + m[7] * y + m[15];
    return [(m[0] * x + m[4] * y + m[12]) / w, (m[1] * x + m[5] * y + m[13]) / w];
  };
  const values = (css: string) => css.slice('matrix3d('.length, -1).split(',').map(Number);

  it('maps the corners of the screen box onto the projected corners of the screen', () => {
    const quad: [number, number][] = [
      [100, 80],
      [420, 120],
      [400, 700],
      [90, 650]
    ];
    const m = values(quadMatrix(1206, 2622, quad));

    [[0, 0], [1206, 0], [1206, 2622], [0, 2622]].forEach(([x, y], k) => {
      const [qx, qy] = apply(m, x, y);
      expect(qx).toBeCloseTo(quad[k][0], 6);
      expect(qy).toBeCloseTo(quad[k][1], 6);
    });
  });

  it('a screen turned away or behind the camera is hidden', () => {
    const front: [number, number, number][] = [[0, 0, 0.5], [10, 0, 0.5], [10, 10, 0.5], [0, 10, 0.5]];
    const back = [front[1], front[0], front[3], front[2]];
    const behind = front.map(([x, y]) => [x, y, 1.2] as [number, number, number]);

    expect(faceShown(front)).toBe(true);
    expect(faceShown(back)).toBe(false);
    expect(faceShown(behind)).toBe(false);
  });
});
