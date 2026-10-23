import { describe, expect, it } from 'vitest';
import { CANVAS_MODES, CanvasMode } from './canvas-mode';

describe('canvas modes', () => {
  it('view mode is read-only: nothing drags, connects or selects', () => {
    const view = CANVAS_MODES[CanvasMode.View];

    expect(view.flow).toMatchObject({
      nodesDraggable: false,
      nodesConnectable: false,
      elementsSelectable: false
    });
    expect(view.chrome).toBe(false);
  });

  it('edit mode keeps the chrome', () => {
    expect(CANVAS_MODES[CanvasMode.Edit].chrome).toBe(true);
  });
});
