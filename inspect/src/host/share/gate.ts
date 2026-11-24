import type { VisitorInfo } from '../../../../packages/share-protocol/src/frame';
import { canEdit } from '../../../../packages/share-protocol/src/visitor';
import { ToHost } from '../../messages';

export const EDIT_LOCK_MS = 60_000;

const VIEWERS_CANNOT = 'viewers cannot edit';
const HOST_ONLY = 'only the host can do that';

type Message = { kind?: string; [key: string]: unknown };

enum Access {
  Anyone = 'anyone',
  Editors = 'editors'
}

type Rule = { access: Access; element?: (message: Message) => string | null };

const at = (message: Message) => (typeof message.at === 'string' ? message.at : null);
const askAt = (message: Message) => ((message.ask as { at?: unknown } | undefined)?.at as string | undefined) ?? null;
const from = (message: Message) => (typeof message.from === 'string' ? message.from : null);

const READ: Rule = { access: Access.Anyone };
const EDIT: Rule = { access: Access.Editors };
const onElement = (element: Rule['element']): Rule => ({ access: Access.Editors, element });

const RULES: Partial<Record<string, Rule>> = {
  [ToHost.Ready]: READ,
  [ToHost.Picked]: READ,
  [ToHost.Selected]: READ,
  [ToHost.Cursor]: READ,
  [ToHost.Wiring]: READ,
  [ToHost.Comments]: READ,
  [ToHost.IconSearch]: READ,
  [ToHost.IconPreviews]: READ,
  [ToHost.Edit]: onElement(askAt),
  [ToHost.Font]: onElement(askAt),
  [ToHost.SaveVariable]: onElement(askAt),
  [ToHost.Move]: onElement(from),
  [ToHost.Structure]: onElement(at),
  [ToHost.AddImage]: onElement(at),
  [ToHost.IconSwap]: onElement(at),
  [ToHost.IconMarkup]: onElement(at),
  [ToHost.IconGet]: onElement(at),
  [ToHost.Link]: onElement(at),
  [ToHost.Attribute]: onElement(at),
  [ToHost.Go]: onElement(at),
  [ToHost.Undo]: EDIT,
  [ToHost.Redo]: EDIT,
  [ToHost.Revert]: EDIT,
  [ToHost.ImageUpload]: EDIT
};

export type Verdict = { ok: true } | { ok: false; reason: string; quiet?: boolean };

const ALLOWED: Verdict = { ok: true };
const refused = (reason: string): Verdict => ({ ok: false, reason });

export function editGate(now: () => number = Date.now) {
  const locks = new Map<string, { userId: string; name: string; until: number }>();

  function lockFor(visitor: VisitorInfo, element: string): Verdict {
    const held = locks.get(element);
    if (held && held.userId !== visitor.userId && held.until > now()) {
      return refused(`${held.name} is editing this element`);
    }
    locks.set(element, { userId: visitor.userId, name: visitor.name, until: now() + EDIT_LOCK_MS });
    return ALLOWED;
  }

  return {
    check(visitor: VisitorInfo, message: Message): Verdict {
      const rule = message.kind === undefined ? undefined : RULES[message.kind];
      if (!rule) {
        return { ok: false, reason: HOST_ONLY, quiet: true };
      }
      if (rule.access === Access.Anyone) {
        return ALLOWED;
      }
      if (!canEdit(visitor.role)) {
        return refused(VIEWERS_CANNOT);
      }
      const element = rule.element?.(message);
      return element ? lockFor(visitor, element) : ALLOWED;
    },
    release(userId: string) {
      [...locks].filter(([, lock]) => lock.userId === userId).forEach(([element]) => locks.delete(element));
    }
  };
}
