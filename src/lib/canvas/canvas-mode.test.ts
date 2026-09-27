import { describe, expect, it } from 'vitest';
import { CANVAS_MODES, CanvasMode } from './canvas-mode';

describe('canvas modes', () => {
  it('view mode is read-only: nothing drags, connects, selects or deletes', () => {
    const view = CANVAS_MODES[CanvasMode.View];

    expect(view.flow).toMatchObject({
      nodesDraggable: false,
      nodesConnectable: false,
      elementsSelectable: false,
      selectionOnDrag: false,
      deleteKey: null
    });
    expect(view.chrome).toBe(false);
  });

  it('view mode still pans and zooms', () => {
    const view = CANVAS_MODES[CanvasMode.View];

    expect(view.flow.panOnDrag).toBe(true);
    expect(view.flow.zoomOnScroll).toBe(true);
    expect(view.flow.zoomOnPinch).toBe(true);
  });

  it('edit mode keeps the chrome', () => {
    expect(CANVAS_MODES[CanvasMode.Edit].chrome).toBe(true);
  });
});
