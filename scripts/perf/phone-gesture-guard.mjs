import { webkit } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5197/';
const MB = 1024 * 1024;
const SETTLE_MS = 12_000;
const STEPS = 60;
const RECOVER_MS = 15_000;

const PROFILES = {
  iphone: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  ipad: { viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
};

const UPLOAD_MB_PER_FRAME = {
  iphone: 20,
  ipad: 120
};

function countUploads() {
  const seen = { bytes: 0, frames: 0 };
  window.__uploads = seen;
  const G = window.WebGL2RenderingContext;
  const storage = G.prototype.texStorage2D;
  G.prototype.texStorage2D = function (target, levels, format, w, h) {
    seen.bytes += w * h * 4;
    return storage.call(this, target, levels, format, w, h);
  };
  const image = G.prototype.texImage2D;
  G.prototype.texImage2D = function (...a) {
    const sized = typeof a[3] === 'number' && typeof a[4] === 'number' && a.length >= 8;
    seen.bytes += sized ? a[3] * a[4] * 4 : (a[5]?.width ?? 0) * (a[5]?.height ?? 0) * 4;
    return image.apply(this, a);
  };
  const tick = () => {
    seen.frames++;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const twoFingerPan = (page, size) =>
  page.evaluate(
    async ({ size, steps }) => {
      const surface = document.querySelector('.surface');
      const box = surface.getBoundingClientRect();
      const fire = (type, id, x, y) => surface.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: box.left + x, clientY: box.top + y, bubbles: true, cancelable: true, buttons: type === 'pointerup' ? 0 : 1 }));
      const gap = size.width * 0.3;
      const at = (k) => [
        [size.width / 2 - gap / 2 - size.width * 0.8 * k, size.height / 2 - size.height * 0.3 * k],
        [size.width / 2 + gap / 2 - size.width * 0.8 * k, size.height / 2 - size.height * 0.3 * k]
      ];
      let [a, b] = at(0);
      fire('pointerdown', 1, ...a);
      fire('pointerdown', 2, ...b);
      for (let i = 1; i <= steps; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        [a, b] = at(i / steps);
        fire('pointermove', 1, ...a);
        fire('pointermove', 2, ...b);
      }
      fire('pointerup', 1, ...a);
      fire('pointerup', 2, ...b);
    },
    { size, steps: STEPS }
  );

const loseContext = (page) =>
  page.evaluate(() => {
    const lose = document.querySelector('[data-testid=core-canvas]').getContext('webgl2')?.getExtension('WEBGL_lose_context');
    lose?.loseContext();
    return Boolean(lose);
  });

async function guard(name) {
  const browser = await webkit.launch();
  const page = await (await browser.newContext(PROFILES[name])).newPage();
  const failures = [];
  page.on('crash', () => failures.push('page crashed'));
  page.on('console', (m) => m.text().includes('core off') && failures.push(m.text()));
  await page.addInitScript(countUploads);
  await page.goto(BASE);
  await page.waitForSelector('[data-testid=core-canvas]', { state: 'attached', timeout: 120_000 });
  await page.waitForTimeout(SETTLE_MS);

  const before = await page.evaluate(() => ({ ...window.__uploads }));
  await twoFingerPan(page, PROFILES[name].viewport);
  const after = await page.evaluate(() => ({ ...window.__uploads }));
  const perFrame = (after.bytes - before.bytes) / MB / Math.max(1, after.frames - before.frames);
  if (perFrame > UPLOAD_MB_PER_FRAME[name]) {
    failures.push(`two-finger pan uploads ${perFrame.toFixed(1)} MB a frame, over ${UPLOAD_MB_PER_FRAME[name]}`);
  }

  const lost = await loseContext(page);
  await page.waitForFunction(() => Number(document.querySelector('[data-testid=core-canvas]')?.dataset.held ?? 0) > 0 && !document.querySelector('[data-testid=core-canvas]').getContext('webgl2')?.isContextLost(), null, { timeout: RECOVER_MS }).catch(() => failures.push('canvas did not come back after a lost GL context'));

  await browser.close();
  console.log(JSON.stringify({ profile: name, uploadMbPerFrame: +perFrame.toFixed(1), contextLost: lost, failures }));
  return failures;
}

const failed = [];
for (const name of (process.env.PROFILES ?? Object.keys(PROFILES).join(",")).split(",")) {
  failed.push(...(await guard(name)));
}
process.exit(failed.length ? 1 : 0);
