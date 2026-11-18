import { addCanvasGuide, moveCanvasGuide, removeCanvasGuide, type CanvasGuide } from './canvas-rulers';

const KEY_PREFIX = 'feega:canvas-guides:';

function read(canvasId: string): CanvasGuide[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY_PREFIX + canvasId) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((g) => (g?.axis === 'x' || g?.axis === 'y') && typeof g.at === 'number') : [];
  } catch {
    return [];
  }
}

function write(canvasId: string, guides: readonly CanvasGuide[]) {
  try {
    localStorage.setItem(KEY_PREFIX + canvasId, JSON.stringify(guides));
  } catch {
    return;
  }
}

class CanvasGuides {
  list = $state<CanvasGuide[]>([]);
  private canvasId = '';

  load(canvasId: string) {
    this.canvasId = canvasId;
    this.list = read(canvasId);
  }

  add(guide: CanvasGuide) {
    this.set(addCanvasGuide(this.list, guide));
  }

  move(from: CanvasGuide, at: number) {
    this.set(moveCanvasGuide(this.list, from, at));
  }

  remove(guide: CanvasGuide) {
    this.set(removeCanvasGuide(this.list, guide));
  }

  private set(next: CanvasGuide[]) {
    this.list = next;
    write(this.canvasId, next);
  }
}

export const canvasGuides = new CanvasGuides();
