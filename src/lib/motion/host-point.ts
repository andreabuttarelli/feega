type ClientBox = { left: number; top: number; width: number; height: number };
type Size = { width: number; height: number };
type Pt = [number, number];

const NO_TURN = 'none';

export function fractionIn(box: ClientBox, layout: Size, degrees: number, [x, y]: Pt): Pt {
  const r = (degrees * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const scale = box.width / (layout.width * Math.abs(cos) + layout.height * Math.abs(sin));
  const dx = x - (box.left + box.width / 2);
  const dy = y - (box.top + box.height / 2);
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;
  return [localX / (layout.width * scale) + 0.5, localY / (layout.height * scale) + 0.5];
}

function turnOf(el: Element): number {
  let degrees = 0;
  for (let at: Element | null = el; at; at = at.parentElement) {
    const turn = getComputedStyle(at).rotate;
    if (turn && turn !== NO_TURN) {
      degrees += parseFloat(turn) || 0;
    }
  }
  return degrees;
}

export function hostFraction(host: HTMLElement, e: PointerEvent): Pt {
  const layout = { width: host.offsetWidth, height: host.offsetHeight };
  return fractionIn(host.getBoundingClientRect(), layout, turnOf(host), [e.clientX, e.clientY]);
}
