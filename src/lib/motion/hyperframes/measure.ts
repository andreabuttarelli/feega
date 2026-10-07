import { js } from './html';

export const MEASURE_REQUEST = 'feega:measure';
export const MEASURE_REPLY = 'feega:measured';

export type MeasuredBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};
export type MeasureRequest = { type: typeof MEASURE_REQUEST; id: string };
export type MeasureReply = {
  type: typeof MEASURE_REPLY;
  id: string;
  boxes: Record<string, MeasuredBox>;
};

type Kinds = { posed: string; solid: string[] };

const KINDS: Kinds = {
  posed: '.kp,.kf,.ks,.fx,.layer,#world',
  solid: ['svg', 'canvas', 'img', 'video', 'iframe']
};

export function measureClips(root: HTMLElement, kinds: Kinds = KINDS): Record<string, MeasuredBox> {
  const posed = [...root.querySelectorAll<HTMLElement>(kinds.posed)];
  const saved = posed.map((el) => el.style.transform);
  posed.forEach((el) => (el.style.transform = 'none'));

  const frame = root.getBoundingClientRect();
  const boxes: Record<string, MeasuredBox> = {};

  for (const layer of root.querySelectorAll<HTMLElement>('[data-clip]')) {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    for (const el of layer.querySelectorAll('*')) {
      const solid = kinds.solid.includes(el.tagName.toLowerCase());
      if (!solid && el.children.length) {
        continue;
      }
      if (el.parentElement && el.parentElement !== layer && kinds.solid.includes(el.parentElement.tagName.toLowerCase())) {
        continue;
      }
      const text = !solid && el.textContent?.trim() ? document.createRange() : null;
      text?.selectNodeContents(el);
      const inked = text?.getBoundingClientRect?.();
      const r = inked && inked.width > 0 && inked.height > 0 ? inked : el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) {
        continue;
      }
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.left + r.width);
      bottom = Math.max(bottom, r.top + r.height);
    }

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

  posed.forEach((el, i) => (el.style.transform = saved[i]));
  return boxes;
}

export function measureScript(): string {
  return `<script>(function(){var KINDS=${js(KINDS)};var measureClips=${measureClips.toString()};addEventListener('message',function(e){var m=e.data;if(!m||m.type!==${js(MEASURE_REQUEST)}||!e.source){return;}var root=document.getElementById('root');if(!root){return;}e.source.postMessage({type:${js(MEASURE_REPLY)},id:m.id,boxes:measureClips(root,KINDS)},'*');});})();</script>`;
}
