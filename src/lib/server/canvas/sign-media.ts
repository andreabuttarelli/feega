import type { Db } from '$lib/server/db/client';
import { createServiceRoleDb } from '$lib/server/db/client';
import { isRlsScoped } from '$lib/server/rls-client';
import { signKnowledgePaths } from '$lib/server/media-archive';
import { signAssetFiles, SIGNED_URL_TTL_S } from '$lib/server/repos/asset-storage';
import { SERVICE_ROLE_USES, type ServiceRoleUse } from '$lib/server/db/service-role-uses';
import type { ThumbnailPreset } from '$lib/server/media-thumbnails';

function assetSigningUse(): ServiceRoleUse {
  const use = SERVICE_ROLE_USES.find((entry) => entry.path.startsWith('src/lib/server/canvas/sign-media.ts'));
  if (!use) {
    throw new Error('signAssetPaths: voce mancante in service-role-uses.ts');
  }
  return use;
}

const ABSOLUTE_URL = /^https?:\/\//;
const SIGNED_COLUMNS = ['url', 'proxy_url'] as const;
const PROVIDER_INPUT_TTL_S = SIGNED_URL_TTL_S.providerInput;

export async function signMediaPaths(db: Db, paths: string[], ttlSeconds: number = PROVIDER_INPUT_TTL_S): Promise<string[]> {
  const stored = paths.filter((p) => !ABSOLUTE_URL.test(p));
  const [rendered, uploaded] = await Promise.all([
    signKnowledgePaths(db as never, stored, ttlSeconds),
    signAssetFiles(db, stored, ttlSeconds)
  ]);

  return paths
    .map((p) => (ABSOLUTE_URL.test(p) ? p : rendered.get(p) ?? uploaded.get(p) ?? null))
    .filter((url): url is string => url !== null);
}

export async function signOrgMediaPaths(db: Db, orgId: string, paths: string[], ttlSeconds: number = PROVIDER_INPUT_TTL_S): Promise<string[]> {
  const stored = [...new Set(paths.filter((p) => p && !ABSOLUTE_URL.test(p)))];
  const held = new Set<string>();
  if (stored.length) {
    const client = db as unknown as { from(t: string): { select(c: string): { eq(c: string, v: string): { in(c: string, v: string[]): Promise<{ data: unknown; error: unknown }> } } } };
    const found = await Promise.all(SIGNED_COLUMNS.map((column) => client.from('assets').select('url, proxy_url').eq('org_id', orgId).in(column, stored)));
    if (found.some((r) => r.error)) {
      throw new Error('signOrgMediaPaths: the asset rows are unreadable');
    }
    for (const row of found.flatMap((r) => (r.data ?? []) as Array<{ url: string | null; proxy_url: string | null }>)) {
      for (const path of [row.url, row.proxy_url]) {
        if (path) {
          held.add(path);
        }
      }
    }
  }
  return signMediaPaths(db, paths.filter((p) => ABSOLUTE_URL.test(p) || held.has(p)), ttlSeconds);
}

/**
 * FIRMA UN ASSET PER CHIUNQUE POSSA LEGGERE LA SUA RIGA, NON SOLO PER CHI L'HA GENERATO.
 *
 * `brand-knowledge` ha cartelle per utente (`<userId>/media/...`): la sola policy di lettura
 * confronta il primo segmento del path con `auth.uid()`, quindi il client dell'utente firma solo
 * i propri file. Ma la visibilità che conta è quella della riga `assets` — la RLS dell'org l'ha
 * già provata leggendola con `userDb` PRIMA di chiamare questa funzione. Firmare è un passo
 * separato e più permissivo di proposito: userDb dimostra l'appartenenza all'org, serviceDb firma
 * il file di chiunque in quell'org.
 *
 * `userDb` deve essere marchiato `markRlsScoped` — altrimenti la chiamata rifiuta, perché
 * altrimenti un client di servizio passato per sbaglio come "userDb" salterebbe la prova.
 */
const ownerOf = (path: string) => path.split('/')[0];

type HeldBy = Map<string, string>;
const heldByClient = new WeakMap<object, HeldBy>();

type PathRow = { url: string | null; proxy_url: string | null; org_id: string };

async function orgsHolding(userDb: Db, paths: string[]): Promise<HeldBy> {
  const known = heldByClient.get(userDb) ?? new Map<string, string>();
  heldByClient.set(userDb, known);
  const unknown = [...new Set(paths)].filter((p) => !known.has(p));
  if (!unknown.length) {
    return known;
  }

  const client = userDb as unknown as { from(t: string): { select(c: string): { in(c: string, v: string[]): Promise<{ data: unknown; error: unknown }> } } };
  const found = await Promise.all(SIGNED_COLUMNS.map((column) => client.from('assets').select('url, proxy_url, org_id').in(column, unknown)));
  if (found.some((r) => r.error)) {
    throw new Error('signAssetPaths: the asset rows are unreadable');
  }
  for (const row of found.flatMap((r) => (r.data ?? []) as PathRow[])) {
    for (const column of SIGNED_COLUMNS) {
      const path = row[column];
      if (path && unknown.includes(path)) {
        known.set(path, row.org_id);
      }
    }
  }
  return known;
}

export async function signAssetPaths(
  userDb: Db,
  serviceDb: Db,
  paths: { generated: string[]; uploaded: string[] },
  ttlSeconds?: number,
  preset?: ThumbnailPreset
): Promise<Map<string, string>> {
  if (!isRlsScoped(userDb)) {
    throw new Error('signAssetPaths richiede un client utente scoped RLS come prova di appartenenza');
  }

  const wanted = [...paths.generated, ...paths.uploaded];
  const heldBy = await orgsHolding(userDb, wanted);
  const held = wanted.filter((p) => heldBy.has(p));
  const inOrgFolder = (p: string) => ownerOf(p) === heldBy.get(p);
  const [rendered, uploaded] = await Promise.all([
    signKnowledgePaths(serviceDb as never, held.filter((p) => !inOrgFolder(p)), ttlSeconds ?? SIGNED_URL_TTL_S.canvas, preset),
    signAssetFiles(serviceDb, held.filter(inOrgFolder), ttlSeconds ?? SIGNED_URL_TTL_S.canvas, preset)
  ]);

  return new Map([...rendered, ...uploaded]);
}

/** Il client di servizio dichiarato in service-role-uses.ts per signAssetPaths. */
export function createAssetSigningDb(): Db {
  return createServiceRoleDb(assetSigningUse());
}
