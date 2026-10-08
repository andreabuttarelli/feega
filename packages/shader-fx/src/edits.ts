import { z } from 'zod';

export const textEdit = z.object({ find: z.string().min(1), replace: z.string() });

export type TextEdit = z.infer<typeof textEdit>;

export type Edited = { ok: true; text: string } | { ok: false; problem: string };

export function applyEdits(text: string, edits: TextEdit[]): Edited {
  let out = text;
  for (const [i, edit] of edits.entries()) {
    const at = out.indexOf(edit.find);
    if (at < 0) {
      return { ok: false, problem: `edit ${i}: "${edit.find}" not found` };
    }

    out = out.slice(0, at) + edit.replace + out.slice(at + edit.find.length);
  }

  return { ok: true, text: out };
}
