import { mountCapturePlayer } from '$lib/motion/hyperframes/capture-player';
import { FrameFormat } from '$lib/motion/hyperframes/capture';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import { runCheck, type CheckShot } from '$lib/motion/custom/run-check';
import { decodeLuma } from '$lib/motion/custom/luma-decode';
import type { BrandTokens } from '$lib/motion/brand';
import type { AudioAnalysis } from '$lib/motion/audio-analysis';
import type { MotionDoc } from '$lib/motion/doc';
import { framesUrl, type RequestPorts } from './agent-requests';

const FRAME_WIDTH = 640;
const CHECK_WIDTH = 480;
const JPEG_QUALITY = 0.72;

export type AskedFrame = { projectId: string; nodeId: string; tokens: BrandTokens; assets: Record<string, string>; analyses?: Record<string, AudioAnalysis> };

async function drawDoc(html: string, doc: MotionDoc, times: number[], width: number): Promise<CheckShot[]> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.dataset.testid = 'agent-capture';
  host.style.cssText = `position:fixed;left:0;top:0;width:${doc.width}px;height:${doc.height}px;opacity:0;pointer-events:none;z-index:-1`;
  document.body.appendChild(host);

  const player = await mountCapturePlayer(host, html);
  const request = { format: FrameFormat.Jpeg, width, height: Math.round((width * doc.height) / doc.width), quality: JPEG_QUALITY };
  try {
    const shots: CheckShot[] = [];
    for (const time of times) {
      const reply = await player.shoot(time, request);
      shots.push({ time, data: reply.url ?? '', layout: reply.layout ?? '', errors: reply.errors ?? [] });
    }
    return shots;
  } finally {
    player.dispose();
    host.remove();
  }
}

export function browserPorts(asked: AskedFrame): RequestPorts {
  const compose = (doc: MotionDoc) => composeHtml({ doc, tokens: asked.tokens, assets: asked.assets, analyses: asked.analyses });
  return {
    frames: (doc, times) => drawDoc(compose(doc), doc, times, FRAME_WIDTH),
    check: (doc, name) => runCheck(doc, name, { compose, capture: (times, html) => drawDoc(html, doc, times, CHECK_WIDTH), luma: decodeLuma }),
    send: async (answer) => {
      await fetch(framesUrl(asked.projectId, asked.nodeId), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(answer) });
    }
  };
}
