const SRC_TAIL = 64;

type ScreenSource = { src?: string; currentSrc?: string; currentTime?: number; naturalWidth?: number; videoWidth?: number } | null;

export function drawOnce(draw: (time: number) => void, sources: () => string = () => ''): { at: (time: number) => void; again: (time?: number) => void } {
  let drawn: string | null = null;
  let last = 0;
  const paint = (time: number) => {
    last = time;
    drawn = `${time}#${sources()}`;
    draw(time);
  };
  return {
    at: (time) => {
      if (`${time}#${sources()}` !== drawn) {
        paint(time);
      }
    },
    again: (time = last) => paint(time)
  };
}

export function screenKey(source: ScreenSource, scroll: number): string {
  if (!source) {
    return 'none';
  }
  const time = source.currentTime === undefined ? '' : source.currentTime;
  const url = source.currentSrc || source.src || '';
  return `${url.length}:${url.slice(-SRC_TAIL)}|${time}|${source.videoWidth || source.naturalWidth || 0}|${scroll}`;
}
