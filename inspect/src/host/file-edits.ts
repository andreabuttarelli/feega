import { readFile, writeFile } from 'node:fs/promises';
import { stylePatch } from '@feega/live-edit/class-patch';
import { inside, liveAtOf, reader, tokenOf, type LiveEditAsk } from '@feega/live-edit/live-ask';
import { LiveProp } from '@feega/live-edit/live-fields';

export type Written = { ok: true; path: string; written: string } | { ok: false; reason: string };

type Step = { full: string; before: string; after: string };

const TEXT_REFUSED = 'text edits are not written by Feega Inspect yet';
const NOTHING_TO_UNDO = 'nothing to undo';
const CHANGED_SINCE = 'the file changed after the edit: not restored';

export function fileEdits(root: string) {
  const steps: Step[] = [];
  let turn: Promise<unknown> = Promise.resolve();

  const inTurn = <T>(work: () => Promise<T>): Promise<T> => {
    const next = turn.then(work, work);
    turn = next.catch(() => undefined);
    return next;
  };

  async function edited(ask: LiveEditAsk): Promise<Written> {
    const at = liveAtOf(ask.at);
    const full = at ? inside(root, at.file) : null;
    if (!at || !full) {
      return { ok: false, reason: `${ask.at} is not a file:line:col inside the workspace` };
    }
    if (ask.prop === LiveProp.Text) {
      return { ok: false, reason: TEXT_REFUSED };
    }

    const token = await tokenOf(root, ask);
    const out = await stylePatch(reader(root), at, { prop: ask.prop, family: ask.family, value: token ?? ask.value ?? '', side: ask.side, viewport: ask.viewport });
    if (out.skipped.length) {
      return { ok: false, reason: out.skipped[0] };
    }

    const [change] = out.files;
    if (!change) {
      return { ok: true, path: at.file, written: token ?? '' };
    }
    await writeFile(full, change.after);
    steps.push({ full, before: change.before, after: change.after });
    return { ok: true, path: at.file, written: token ?? '' };
  }

  async function undone(): Promise<Written> {
    const step = steps.pop();
    if (!step) {
      return { ok: false, reason: NOTHING_TO_UNDO };
    }
    const now = await readFile(step.full, 'utf8').catch(() => null);
    if (now !== step.after) {
      return { ok: false, reason: CHANGED_SINCE };
    }
    await writeFile(step.full, step.before);
    return { ok: true, path: step.full, written: '' };
  }

  return {
    edit: (ask: LiveEditAsk) => inTurn(() => edited(ask)),
    undo: () => inTurn(undone)
  };
}
