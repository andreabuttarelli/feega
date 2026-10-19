export type Box = Pick<Element, 'getBoundingClientRect'>;
export type Watch = (targets: readonly Box[], onchange: () => void) => () => void;
type Rect = { top: number; height: number };

export function dockLift(bottom: number, docks: readonly Rect[]): number {
  const tops = docks.filter((r) => r.height > 0 && r.top < bottom).map((r) => bottom - r.top);
  return Math.max(0, Math.round(Math.max(0, ...tops)));
}

export const resizeWatch: Watch = (targets, onchange) => {
  const observer = new ResizeObserver(onchange);
  for (const target of targets) {
    observer.observe(target as Element);
  }
  window.addEventListener('resize', onchange);
  return () => {
    observer.disconnect();
    window.removeEventListener('resize', onchange);
  };
};

const sameDocks = (a: readonly Box[], b: readonly Box[]) => a.length === b.length && a.every((box, i) => box === b[i]);

export function followDocks(host: Box, docks: () => readonly Box[], onlift: (px: number) => void, watch: Watch = resizeWatch): () => void {
  let watched: readonly Box[] = [];
  let stop = () => {};

  const read = () => {
    const current = docks();
    onlift(dockLift(host.getBoundingClientRect().bottom, current.map((dock) => dock.getBoundingClientRect())));
    if (sameDocks(current, watched)) {
      return;
    }
    stop();
    watched = current;
    stop = watch([host, ...current], read);
  };

  read();
  return () => stop();
}
