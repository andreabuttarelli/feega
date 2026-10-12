import { MotionFormat, newMotionDoc } from '../../../src/lib/motion/doc';
import { FEEGA_TOKENS } from '../../../src/lib/motion/brand';
import { composeHtml } from '../../../src/lib/motion/hyperframes/compose';
import { FrameFormat, Settle } from '../../../src/lib/motion/hyperframes/capture';
import { mountCapturePlayer } from '../../../src/lib/motion/hyperframes/capture-player';
import { exportLayering, frameOf } from '../../../src/lib/motion/export/webgl-device';
import { probeOf } from '../../../src/lib/motion/export/encode';
import { frameDiffs } from '../../../src/lib/motion/smoothness';
import { insertTemplate, setTemplateValues } from '../../../src/lib/motion/template/library';
import { SPLIT_HEADLINE_TEMPLATE } from '../../../src/lib/motion/template/split-headline/template';

const FPS = 60;
const SHOT_WAIT_MS = 5_000;
const PHOTO = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#777"/></svg>');

export type FpsRun = { error: string | null; diffs: number[] };

function splitHeadline() {
  let n = 0;
  const placed = insertTemplate({ ...newMotionDoc(MotionFormat.Landscape), fps: FPS, durationInFrames: 8 * FPS }, SPLIT_HEADLINE_TEMPLATE, { from: 0, newId: () => `f${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  const set = setTemplateValues(placed.doc, placed.clipId, { media: 'photo' });
  if (!set.ok) {
    throw new Error(set.error);
  }
  return set.doc;
}

async function render(frames: number): Promise<FpsRun> {
  const doc = splitHeadline();
  const size = { width: doc.width, height: doc.height };
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:0;top:0;width:${doc.width}px;height:${doc.height}px;`;
  document.body.appendChild(host);

  const player = await mountCapturePlayer(host, composeHtml({ doc, tokens: FEEGA_TOKENS, assets: { photo: PHOTO } }));
  const request = { format: FrameFormat.Bitmap, settle: Settle.Seek, layering: exportLayering(), ...size };
  const pixels: Uint8Array[] = [];
  const look = probeOf(size, { add: (frame) => pixels.push(Uint8Array.from(frame)), jolts: () => [] })!;

  try {
    for (let f = 0; f < frames; f++) {
      const bitmap = frameOf(await player.shoot(f / FPS, request, SHOT_WAIT_MS));
      look(bitmap);
      bitmap.close();
    }
    return { error: null, diffs: frameDiffs(pixels) };
  } catch (err) {
    return { error: String(err), diffs: frameDiffs(pixels) };
  } finally {
    player.dispose();
  }
}

declare global {
  interface Window {
    fpsProbe: { render: typeof render };
  }
}

window.fpsProbe = { render };
