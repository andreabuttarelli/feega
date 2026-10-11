import { MotionFormat, newMotionDoc, type MotionDoc } from '../../../src/lib/motion/doc';
import { FEEGA_TOKENS } from '../../../src/lib/motion/brand';
import { composeHtml } from '../../../src/lib/motion/hyperframes/compose';
import { FrameFormat, Settle } from '../../../src/lib/motion/hyperframes/capture';
import { mountCapturePlayer } from '../../../src/lib/motion/hyperframes/capture-player';
import { exportLayering, frameOf } from '../../../src/lib/motion/export/webgl-device';
import { runCheck } from '../../../src/lib/motion/custom/run-check';
import { decodeLuma } from '../../../src/lib/motion/custom/luma-decode';
import { probeOf } from '../../../src/lib/motion/export/encode';
import { docCuts, frameDiffs, motionJolts, type JoltAt } from '../../../src/lib/motion/smoothness';
import { writeComponent } from '../../../src/lib/motion/custom/ops';
import { vectorPiece } from '../../../src/lib/motion/vector-ui/piece';
import { SHOTS, ShotUi, type ShotId } from '../../../src/lib/motion/shots/library';
import { addShot, shotComponent } from '../../../src/lib/motion/shots/ops';
import type { VectorUi } from '../../../src/lib/motion/vector-ui/model';

const UI_NAME = 'UiProbe';
const CHECK_WIDTH = 480;
const CHECK_QUALITY = 0.72;

export type ShotCase = { format: MotionFormat; shot: ShotId; slots: Record<string, unknown>; ui: VectorUi };

const uiOf = (shot: ShotId) => (SHOTS[shot].ui === ShotUi.Required ? UI_NAME : undefined);

function shotDoc({ format, shot, slots, ui }: ShotCase): MotionDoc {
  const piece = vectorPiece(UI_NAME, ui);
  const base = writeComponent(newMotionDoc(format), piece.name, { source: { html: '', css: piece.css, js: piece.js }, propsSchema: { type: 'object', properties: {} } });
  if (!base.ok) {
    throw new Error(base.error);
  }
  const made = addShot(base.doc, { shot, slots, at: 0, ui: uiOf(shot) }, 'shot');
  if (!made.ok) {
    throw new Error(made.error);
  }
  return made.doc;
}

const lastFrame = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips).reduce((end, c) => Math.max(end, c.from + c.durationInFrames), 0);

const compose = (doc: MotionDoc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });

function host(doc: MotionDoc): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;left:0;top:0;width:${doc.width}px;height:${doc.height}px;`;
  document.body.appendChild(el);
  return el;
}

const seekCheck = (c: ShotCase) => seekCheckDoc(shotDoc(c), shotComponent(c.shot, uiOf(c.shot)));

async function seekCheckDoc(doc: MotionDoc, name: string): Promise<string[]> {
  const request = { format: FrameFormat.Jpeg, width: CHECK_WIDTH, height: Math.round((CHECK_WIDTH * doc.height) / doc.width), quality: CHECK_QUALITY };
  const capture = async (times: number[], html: string) => {
    const player = await mountCapturePlayer(host(doc), html);
    const shots = [];
    for (const time of times) {
      const reply = await player.shoot(time, request);
      shots.push({ time, data: reply.url ?? '', layout: reply.layout ?? '', errors: reply.errors ?? [] });
    }
    player.dispose();
    return shots;
  };
  const run = await runCheck(doc, name, { compose, capture, luma: decodeLuma });
  return run.check.problems;
}

async function jolts(c: ShotCase): Promise<{ jolts: JoltAt[]; diffs: number[] }> {
  const doc = shotDoc(c);
  const size = { width: doc.width, height: doc.height };
  const player = await mountCapturePlayer(host(doc), compose(doc));
  const request = { format: FrameFormat.Bitmap, settle: Settle.Seek, layering: exportLayering(), ...size };
  const frames: Uint8Array[] = [];
  const look = probeOf(size, { add: (frame) => frames.push(Uint8Array.from(frame)), jolts: () => [] })!;
  for (let f = 0; f < lastFrame(doc); f++) {
    const bitmap = frameOf(await player.shoot(f / doc.fps, request));
    look(bitmap);
    bitmap.close();
  }
  player.dispose();
  const diffs = frameDiffs(frames);
  return { jolts: motionJolts(diffs, { cuts: docCuts(doc) }), diffs: diffs.map((d) => Math.round(d * 100) / 100) };
}

declare global {
  interface Window {
    shotProbe: { seekCheck: typeof seekCheck; seekCheckDoc: typeof seekCheckDoc; jolts: typeof jolts };
  }
}

window.shotProbe = { seekCheck, seekCheckDoc, jolts };
