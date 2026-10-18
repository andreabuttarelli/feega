import { js } from './html';

export const MEASURE_REQUEST = 'feega:measure';
export const MEASURE_REPLY = 'feega:measured';
export const REDRAWN = 'feega:redrawn';
export const DRAWN_EVENT = 'motion-drawn';
export const DRAWN_FALLBACK_MS = 600;
export const REDRAW_QUIET_MS = 150;

export type MeasuredBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};
export enum Pose {
  Base = 'base',
  Posed = 'posed'
}

export type MeasureRequest = { type: typeof MEASURE_REQUEST; id: string; pose?: Pose };
export type MeasureReply = {
  type: typeof MEASURE_REPLY;
  id: string;
  boxes: Record<string, MeasuredBox>;
};

type Kinds = { posed: string | null; solid: string[]; part: string };

const KINDS: Kinds = {
  posed: '.kp,.kf,.ks,.fx,.layer,#world',
  solid: ['svg', 'canvas', 'img', 'video', 'iframe'],
  part: 'data-part'
};

const KINDS_BY_POSE: Record<Pose, Kinds> = {
  [Pose.Base]: KINDS,
  [Pose.Posed]: { ...KINDS, posed: null }
};

export const kindsOf = (pose: Pose): Kinds => KINDS_BY_POSE[pose];

export function measureClips(root: HTMLElement, kinds: Kinds = KINDS): Record<string, MeasuredBox> {
  const posed = kinds.posed ? [...root.querySelectorAll<HTMLElement>(kinds.posed)] : [];
  const saved = posed.map((el) => el.style.transform);
  posed.forEach((el) => (el.style.transform = 'none'));

  const frame = root.getBoundingClientRect();
  const boxes: Record<string, MeasuredBox> = {};

  const inkRects = (layer: HTMLElement): DOMRect[] =>
    [...layer.querySelectorAll('*')].flatMap((el) => {
      const solid = kinds.solid.includes(el.tagName.toLowerCase());
      if (!solid && el.children.length) {
        return [];
      }
      if (el.parentElement && el.parentElement !== layer && kinds.solid.includes(el.parentElement.tagName.toLowerCase())) {
        return [];
      }
      const text = !solid && el.textContent?.trim() ? document.createRange() : null;
      text?.selectNodeContents(el);
      const inked = text?.getBoundingClientRect?.();
      return [inked && inked.width > 0 && inked.height > 0 ? inked : el.getBoundingClientRect()];
    });

  for (const layer of root.querySelectorAll<HTMLElement>('[data-clip]')) {
    const own = layer.querySelector('[data-box]');
    const rects = (own ? [own.getBoundingClientRect()] : inkRects(layer)).filter((r) => r.width > 0 && r.height > 0);
    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    const right = Math.max(...rects.map((r) => r.left + r.width));
    const bottom = Math.max(...rects.map((r) => r.top + r.height));

    if (left === Infinity || frame.width <= 0 || frame.height <= 0) {
      continue;
    }
    boxes[layer.dataset.clip!] = {
      left: (left - frame.left) / frame.width,
      top: (top - frame.top) / frame.height,
      width: (right - left) / frame.width,
      height: (bottom - top) / frame.height
    };
  }

  for (const layer of root.querySelectorAll<HTMLElement>('[data-clip]')) {
    for (const el of layer.querySelectorAll<HTMLElement>('[' + kinds.part + ']')) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || frame.width <= 0 || frame.height <= 0) {
        continue;
      }
      boxes[layer.dataset.clip + '#' + el.getAttribute(kinds.part)] = {
        left: (r.left - frame.left) / frame.width,
        top: (r.top - frame.top) / frame.height,
        width: r.width / frame.width,
        height: r.height / frame.height
      };
    }
  }

  posed.forEach((el, i) => (el.style.transform = saved[i]));
  return boxes;
}

export function watchRedraws(drawing: Node, redrawn: () => void, quietMs: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const settle = () => {
    clearTimeout(timer);
    timer = setTimeout(redrawn, quietMs);
  };
  const watcher = new MutationObserver(settle);
  watcher.observe(drawing, { subtree: true, attributes: true, childList: true, characterData: true });
  document.fonts?.addEventListener?.('loadingdone', settle);
  return () => void watcher.takeRecords();
}

export function measureScript(): string {
  return `<script>(function(){var KINDS=${js(KINDS_BY_POSE)};var measureClips=${measureClips.toString()};var watchRedraws=${watchRedraws.toString()};var forget=watchRedraws(document.body,function(){parent.postMessage({type:${js(REDRAWN)}},'*');},${REDRAW_QUIET_MS});addEventListener('message',function(e){var m=e.data;if(!m||m.type!==${js(MEASURE_REQUEST)}||!e.source){return;}var root=document.getElementById('root');if(!root){return;}var boxes=measureClips(root,KINDS[m.pose]||KINDS[${js(Pose.Base)}]);forget();e.source.postMessage({type:${js(MEASURE_REPLY)},id:m.id,boxes:boxes},'*');});})();</script>`;
}
