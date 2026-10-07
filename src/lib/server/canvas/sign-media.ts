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
const PROVIDER_INPUT_TTL_S = SIGNED_URL_TTL_S.providerInput;

export async function signMediaPaths(db: Db, paths: string[]): Promise<string[]> {
  const stored = paths.filter((p) => !ABSOLUTE_URL.test(p));
  const [rendered, uploaded] = await Promise.all([
    signKnowledgePaths(db as never, stored, PROVIDER_INPUT_TTL_S),
    signAssetFiles(db, stored, PROVIDER_INPUT_TTL_S)
  ]);

  return paths
    .map((p) => (ABSOLUTE_URL.test(p) ? p : rendered.get(p) ?? uploaded.get(p) ?? null))
    .filter((url): url is string => url !== null);
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

  return signJobAssetPaths(serviceDb, paths, ttlSeconds, preset);
}

export async function signJobAssetPaths(serviceDb: Db, paths: { generated: string[]; uploaded: string[] }, ttlSeconds?: number, preset?: ThumbnailPreset): Promise<Map<string, string>> {
  const [rendered, uploaded] = await Promise.all([
    signKnowledgePaths(serviceDb as never, paths.generated, ttlSeconds ?? SIGNED_URL_TTL_S.canvas, preset),
    signAssetFiles(serviceDb, paths.uploaded, ttlSeconds ?? SIGNED_URL_TTL_S.canvas, preset)
  ]);

  return new Map([...rendered, ...uploaded]);
}

/** Il client di servizio dichiarato in service-role-uses.ts per signAssetPaths. */
export function createAssetSigningDb(): Db {
  return createServiceRoleDb(assetSigningUse());
}
