import { Origin, type Catalog } from '@feega/plugin-api/external';
import type { Manifest } from '@feega/plugin-api/manifest';
import { wordsOf } from '@feega/plugin-api/permission-words';

export enum Kind {
  BuiltIn = 'built-in',
  Installed = 'installed',
  Dev = 'dev'
}

export type Row = { id: string; name: string; version: string; kind: Kind; enabled: boolean; words: string[]; badges: string[]; removable: boolean };

const NOT_REVIEWED = 'Not reviewed';

const KINDS: Record<Kind, { badges: string[]; removable: boolean }> = {
  [Kind.BuiltIn]: { badges: [], removable: false },
  [Kind.Installed]: { badges: [NOT_REVIEWED], removable: true },
  [Kind.Dev]: { badges: ['Dev', NOT_REVIEWED], removable: false }
};

const KIND_OF: Record<Origin, Kind> = { [Origin.Installed]: Kind.Installed, [Origin.Dev]: Kind.Dev };

export function rowsOf(builtIn: Manifest[], catalog: Catalog): Row[] {
  const built = builtIn.map((manifest) => ({ id: manifest.id, name: manifest.name, version: manifest.version, kind: Kind.BuiltIn, enabled: !catalog.disabled.includes(manifest.id), words: wordsOf(manifest) }));
  const added = catalog.plugins
    .filter((plugin) => !builtIn.some((manifest) => manifest.id === plugin.id))
    .map((plugin) => ({ id: plugin.id, name: plugin.name, version: plugin.version, kind: KIND_OF[plugin.origin], enabled: plugin.enabled, words: plugin.words }));
  return [...built, ...added].map((row) => ({ ...row, ...KINDS[row.kind] }));
}
