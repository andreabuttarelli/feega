import { z } from 'zod';
import { STYLE_NAME, styleSchema } from '@feega/motion-core/motion/styles-model';
import { VARIABLE_NAME, collectionSchema } from '@feega/motion-core/motion/variables-model';

export enum LibraryKind {
  Style = 'style',
  Variables = 'variables'
}

export enum LibraryOp {
  Save = 'save',
  Rename = 'rename',
  Remove = 'remove',
  Adopt = 'adopt'
}

const NAME_OF: Record<LibraryKind, RegExp> = { [LibraryKind.Style]: STYLE_NAME, [LibraryKind.Variables]: VARIABLE_NAME };

const VALUE_OF: Record<LibraryKind, z.ZodType> = { [LibraryKind.Style]: styleSchema, [LibraryKind.Variables]: collectionSchema };

export function libraryOpSchema(kind: LibraryKind) {
  const name = z.string().regex(NAME_OF[kind], 'names are letters, digits, spaces, - or _');
  const value = VALUE_OF[kind];
  return z.discriminatedUnion('op', [
    z.object({ op: z.literal(LibraryOp.Save), name, value }),
    z.object({ op: z.literal(LibraryOp.Rename), name, to: name }),
    z.object({ op: z.literal(LibraryOp.Remove), name }),
    z.object({ op: z.literal(LibraryOp.Adopt), entries: z.record(name, value) })
  ]);
}

export type LibraryEntries = Record<string, unknown>;

export type LibraryAsk =
  | { op: LibraryOp.Save; name: string; value: unknown }
  | { op: LibraryOp.Rename; name: string; to: string }
  | { op: LibraryOp.Remove; name: string }
  | { op: LibraryOp.Adopt; entries: LibraryEntries };

export const isLibraryKind = (value: string): value is LibraryKind => (Object.values(LibraryKind) as string[]).includes(value);

export type LibraryPort = {
  load: () => Promise<LibraryEntries>;
  run: (ask: LibraryAsk) => Promise<{ ok: true; entries: LibraryEntries } | { ok: false; error: string }>;
};
