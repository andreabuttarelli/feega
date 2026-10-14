import { js } from './html';

export const FRAME_TAP = 'feega:tap';

export type FramePoint = { x: number; y: number };

type FrameTap = FramePoint & { type: typeof FRAME_TAP };

const LIFTED = '2147483647';

export function frameTapScript(): string {
  return `<script>addEventListener('pointerdown',function(e){parent.postMessage({type:${js(FRAME_TAP)},x:e.clientX/innerWidth,y:e.clientY/innerHeight},'*');},true);</script>`;
}

const clamp = (n: number) => Math.min(1, Math.max(0, Number(n) || 0));

const gestured = () => (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation?.isActive === true;

export function listenTap(frame: HTMLIFrameElement, lift: HTMLElement, ontap: (at: FramePoint) => void): () => void {
  const onMessage = (e: MessageEvent) => {
    const tap = e.data as FrameTap;
    if (e.source !== frame.contentWindow || tap?.type !== FRAME_TAP || !gestured()) {
      return;
    }
    ontap({ x: clamp(tap.x), y: clamp(tap.y) });
  };

  frame.style.pointerEvents = 'auto';
  lift.style.zIndex = LIFTED;
  addEventListener('message', onMessage);

  return () => {
    frame.style.pointerEvents = '';
    lift.style.zIndex = '';
    removeEventListener('message', onMessage);
  };
}
