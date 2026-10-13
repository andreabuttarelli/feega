const SCALE = /scale\(([\d.]+)\)/;

type Size = { width: number; height: number };

export const crispScale = (transform: string): string | null => SCALE.exec(transform)?.[1] ?? null;

export const centredAt = (host: Size, frame: Size) => ({ left: Math.round((host.width - frame.width) / 2), top: Math.round((host.height - frame.height) / 2) });

export function keepCrisp(frame: HTMLElement): () => void {
  const convert = () => {
    const zoom = crispScale(frame.style.transform);
    if (zoom) {
      Object.assign(frame.style, { transform: 'none', zoom });
    }
    const host = frame.parentElement?.getBoundingClientRect();
    if (!host || frame.style.transform !== 'none') {
      return;
    }
    const at = centredAt(host, frame.getBoundingClientRect());
    const left = `${at.left}px`;
    const top = `${at.top}px`;
    if (frame.style.left !== left || frame.style.top !== top) {
      Object.assign(frame.style, { left, top });
    }
  };
  const watcher = new MutationObserver(convert);
  convert();
  watcher.observe(frame, { attributes: true, attributeFilter: ['style'] });
  return () => watcher.disconnect();
}
