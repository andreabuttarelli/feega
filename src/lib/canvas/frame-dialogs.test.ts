import { describe, expect, it } from 'vitest';
import { FRAME_DIALOG_ACTIONS, FrameDialog, type FrameDialogActionId } from './frame-dialogs';
import { SELECTION_ACTIONS, isCanvasAction, shownFor } from './selection-actions';
import { SELECTION_ACTION_ICON } from './selection-action-icons';

const frame = { data: { format: '16:9' } };
const image = { data: {} };
const ids = Object.keys(FRAME_DIALOG_ACTIONS) as FrameDialogActionId[];

describe('frame dialog entry points', () => {
  it('each opens one dialog, and every dialog but export has an entry', () => {
    const opened = Object.values(FRAME_DIALOG_ACTIONS);
    expect(new Set(opened).size).toBe(opened.length);
    expect(
      Object.values(FrameDialog)
        .filter((d) => d !== FrameDialog.Export)
        .sort()
    ).toEqual([...opened].sort());
  });

  it('are rows of the selection table in the overflow group, with an icon', () => {
    for (const id of ids) {
      const row = SELECTION_ACTIONS.find((a) => a.id === id);
      expect(row?.group, id).toBe('overflow');
      expect(SELECTION_ACTION_ICON[id], id).toBeDefined();
    }
  });

  it('show for one frame only', () => {
    for (const id of ids) {
      expect(shownFor(id, [frame]), id).toBe(true);
      expect(shownFor(id, [frame, frame]), id).toBe(false);
      expect(shownFor(id, [image]), id).toBe(false);
    }
  });

  it('never run as a canvas action', () => {
    for (const id of ids) {
      expect(isCanvasAction(id), id).toBe(false);
    }
  });
});
