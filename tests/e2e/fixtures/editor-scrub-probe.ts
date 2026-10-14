import { FEEGA_TOKENS } from '../../../src/lib/motion/brand';
import { composeHtml } from '../../../src/lib/motion/hyperframes/compose';
import { exactSeek } from '../../../src/lib/motion/hyperframes/exact-seek';
import { splitHeadline } from './fps-probe';

const INNER_PROBE = `<script>(function(){var gaps=[],work=[],last=0,on=false;var ch=new MessageChannel();var t0=0;ch.port1.onmessage=function(){if(on){work.push(performance.now()-t0);}};function tick(now){if(on&&last){gaps.push(now-last);t0=performance.now();ch.port2.postMessage(0);}last=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);addEventListener('message',function(e){var m=e.data;if(!m||m.type!=='probe:frames'){return;}if(m.start){gaps=[];work=[];on=true;return;}on=false;e.source.postMessage({type:'probe:report',gaps:gaps,work:work},'*');});})();</script>`;

const PHOTO = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#777"/></svg>');

export enum SeekPath {
  Both = 'both',
  PlayerOnly = 'player',
  ExactOnly = 'exact'
}

type Player = HTMLElement & { seek: (t: number) => void; play: () => void; pause: () => void; iframeElement?: HTMLIFrameElement };

let player: Player;
let seconds = 0;

async function mountEditor(): Promise<void> {
  await import('@hyperframes/player');
  const doc = splitHeadline();
  seconds = doc.durationInFrames / doc.fps;
  player = document.createElement('hyperframes-player') as Player;
  player.setAttribute('sandbox-origin', 'opaque');
  player.setAttribute('assets-loading-ui', 'none');
  player.setAttribute('disable-click-to-play', '');
  player.style.cssText = 'position:fixed;left:0;top:0;width:960px;height:540px';
  document.body.replaceChildren(player);
  const ready = new Promise((resolve) => player.addEventListener('ready', resolve, { once: true }));
  player.setAttribute('srcdoc', composeHtml({ doc, tokens: FEEGA_TOKENS, assets: { photo: PHOTO } }).replace('</body>', `${INNER_PROBE}</body>`));
  await ready;
}

function post(message: unknown): boolean {
  const target = player.iframeElement?.contentWindow;
  target?.postMessage(message, '*');
  return !!target;
}

const SEEKS: Record<SeekPath, (t: number) => void> = {
  [SeekPath.Both]: (t) => {
    player.seek(t);
    post(exactSeek(t));
  },
  [SeekPath.PlayerOnly]: (t) => player.seek(t),
  [SeekPath.ExactOnly]: (t) => post(exactSeek(t))
};

function scrub(path: SeekPath, ms: number): Promise<number> {
  return new Promise((resolve) => {
    const start = performance.now();
    let seeks = 0;
    const step = (now: number) => {
      const t = (((now - start) / ms) * seconds) % seconds;
      SEEKS[path](t);
      seeks += 1;
      if (now - start < ms) {
        requestAnimationFrame(step);
        return;
      }
      resolve(seeks);
    };
    requestAnimationFrame(step);
  });
}

function play(ms: number): Promise<void> {
  player.play();
  return new Promise((resolve) =>
    setTimeout(() => {
      player.pause();
      resolve();
    }, ms)
  );
}

function startInner() {
  post({ type: 'probe:frames', start: true });
}

function stopInner(): Promise<{ gaps: number[]; work: number[] }> {
  return new Promise((resolve) => {
    const listen = (e: MessageEvent) => {
      if (e.data?.type !== 'probe:report') {
        return;
      }
      removeEventListener('message', listen);
      resolve({ gaps: e.data.gaps, work: e.data.work });
    };
    addEventListener('message', listen);
    post({ type: 'probe:frames', start: false });
  });
}

declare global {
  interface Window {
    editorScrub: { mount: typeof mountEditor; scrub: typeof scrub; play: typeof play; startInner: typeof startInner; stopInner: typeof stopInner };
  }
}

window.editorScrub = { mount: mountEditor, scrub, play, startInner, stopInner };
