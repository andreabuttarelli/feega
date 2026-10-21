type Point = { x: number; y: number };
type Bounds = { left: number; top: number; width: number; height: number };
type Layout = { width: number; height: number };

const RADIANS_PER_DEGREE = Math.PI / 180;
const TURN_ATTRIBUTE = 'data-turn';

export function fractionIn(client: Point, bounds: Bounds, layout: Layout, degrees: number): Point {
  if (!degrees) {
    return { x: (client.x - bounds.left) / bounds.width, y: (client.y - bounds.top) / bounds.height };
  }
  const back = -degrees * RADIANS_PER_DEGREE;
  const dx = client.x - (bounds.left + bounds.width / 2);
  const dy = client.y - (bounds.top + bounds.height / 2);
  const x = dx * Math.cos(back) - dy * Math.sin(back);
  const y = dx * Math.sin(back) + dy * Math.cos(back);
  return { x: x / layout.width + 0.5, y: y / layout.height + 0.5 };
}

export const unturnedWidth = (bounds: Bounds, layout: Layout, degrees: number): number => (degrees ? layout.width : bounds.width);

const turnOf = (host: HTMLElement): number => Number(host.closest(`[${TURN_ATTRIBUTE}]`)?.getAttribute(TURN_ATTRIBUTE) ?? 0);

export function hostFraction(e: { clientX: number; clientY: number }, host: HTMLElement): Point {
  const bounds = host.getBoundingClientRect();
  return fractionIn({ x: e.clientX, y: e.clientY }, bounds, { width: host.offsetWidth, height: host.offsetHeight }, turnOf(host));
}

export function hostWidth(host: HTMLElement): number {
  return unturnedWidth(host.getBoundingClientRect(), { width: host.offsetWidth, height: host.offsetHeight }, turnOf(host));
}
