export type View = { x: number; y: number; zoom: number };
export type Shot = { width: number; height: number; gray: Uint8Array; view: View };

const TOLERANCE = 40;
const REACH_PX = 1;

function explained(before: Shot, bx: number, by: number, value: number): boolean {
  for (let dy = -REACH_PX; dy <= REACH_PX; dy++) {
    for (let dx = -REACH_PX; dx <= REACH_PX; dx++) {
      const x = bx + dx;
      const y = by + dy;
      if (x < 0 || y < 0 || x >= before.width || y >= before.height) {
        continue;
      }
      if (Math.abs(before.gray[y * before.width + x] - value) <= TOLERANCE) {
        return true;
      }
    }
  }
  return false;
}

export function popShare(before: Shot, after: Shot): number {
  const scale = before.view.zoom / after.view.zoom;
  let seen = 0;
  let changed = 0;
  for (let y = 0; y < after.height; y++) {
    const by = Math.round((y - after.view.y) * scale + before.view.y);
    if (by < 0 || by >= before.height) {
      continue;
    }
    for (let x = 0; x < after.width; x++) {
      const bx = Math.round((x - after.view.x) * scale + before.view.x);
      if (bx < 0 || bx >= before.width) {
        continue;
      }
      seen++;
      changed += explained(before, bx, by, after.gray[y * after.width + x]) ? 0 : 1;
    }
  }
  return seen ? changed / seen : 0;
}

const WHITE = 255;

const BLANK_PX = 6;
const INK_PX = 60;

const near = (value: number, to: number, within: number) => Math.abs(value - to) <= within;
const blankAt = (value: number, paper: number) => near(value, WHITE, BLANK_PX) || near(value, paper, BLANK_PX);
const inkAt = (value: number, paper: number) => !near(value, WHITE, INK_PX) && !near(value, paper, INK_PX);

const COMPARABLE_ZOOM = 2;

export function missingInk(rest: Shot, sample: Shot, paper: number): number | null {
  const scale = rest.view.zoom / sample.view.zoom;
  if (scale > COMPARABLE_ZOOM || scale < 1 / COMPARABLE_ZOOM) {
    return null;
  }
  let ink = 0;
  let missing = 0;
  for (let y = 0; y < sample.height; y++) {
    const ry = Math.round((y - sample.view.y) * scale + rest.view.y);
    if (ry < 0 || ry >= rest.height) {
      continue;
    }
    for (let x = 0; x < sample.width; x++) {
      const rx = Math.round((x - sample.view.x) * scale + rest.view.x);
      if (rx < 0 || rx >= rest.width || !inkAt(rest.gray[ry * rest.width + rx], paper)) {
        continue;
      }
      ink++;
      missing += blankAt(sample.gray[y * sample.width + x], paper) ? 1 : 0;
    }
  }
  return ink ? missing / ink : 0;
}
