import { LookKey } from '$lib/canvas/code-look';
import { LiveProp } from '@feega/live-edit/live-fields';
import { stylePatch, type LiveAt, type LiveChange, type LivePatched } from '@feega/live-edit/class-patch';
import { applyEdits, type ReadFile } from '$lib/server/code-import/write-back';

export type { LiveAt, LiveChange, LivePatched };

function textPatch(read: ReadFile, at: LiveAt, change: LiveChange): Promise<LivePatched> {
  const edit = { at: { file: at.file, line: at.line, column: at.col - 1 }, look: { [LookKey.Text]: change.value }, was: { [LookKey.Text]: change.was ?? '' } };
  return applyEdits([edit], read);
}

export function livePatch(read: ReadFile, at: LiveAt, change: LiveChange): Promise<LivePatched> {
  if (change.prop === LiveProp.Text) {
    return textPatch(read, at, change);
  }
  return stylePatch(read, at, change);
}
