export type Painter<I, F> = {
  load: (url: string) => Promise<I>;
  settles: (url: string) => boolean;
  print: (img: I) => string;
  tick: () => Promise<void>;
  draw: (img: I, width: number, height: number) => F;
};

export async function paintSvg<I, F>(url: string, width: number, height: number, painter: Painter<I, F>, wait = { maxTicks: 12, stillTicks: 3 }): Promise<F> {
  const img = await painter.load(url);
  if (!painter.settles(url)) {
    return painter.draw(img, width, height);
  }

  let before = painter.print(img);
  let changed = false;
  let still = 0;
  for (let tick = 0; tick < wait.maxTicks; tick++) {
    await painter.tick();
    const now = painter.print(img);
    if (now !== before) {
      changed = true;
      still = 0;
      before = now;
      continue;
    }
    still += 1;
    if (changed && still >= wait.stillTicks) {
      break;
    }
  }

  return painter.draw(img, width, height);
}
