/**
 * RIPARA I NODI CON UN URL FIRMATO SCRITTO IN `data` — il bug: `assetDrag`/`brandFieldDrag`/
 * `colourDrag` (`src/lib/canvas/drag-payload.ts`) scrivevano `data.url` con l'URL firmato del
 * momento invece del solo `assetId`. L'URL scade (due ore su Supabase Storage) e il nodo appare
 * rotto da lì in poi — i byte restano nello storage, solo il riferimento persistito è marcio.
 *
 * LA FIRMA DEL BUG: `data->>'assetId'` presente, `data->>'refId'` assente, `data->>'url'` un
 * pattern di storage firmato (`/storage/v1/object/sign/`). Un nodo sano non ha mai questa forma —
 * `refId` (nodi che generano) o `url` come rotta stabile `/p/.../assets/<id>` (upload sani, dopo
 * `registerCanvasUpload`) non incrociano mai il pattern firmato.
 *
 * IDEMPOTENTE E CONCORRENTE-SICURO: ogni update porta `where version = <letta>` — la stessa
 * disciplina ottimistica di ogni scrittura su `nodes` (CLAUDE.md). Una riga la cui versione è
 * cambiata fra lettura e scrittura viene saltata, mai sovrascritta alla cieca, e il salto finisce
 * nel report.
 *
 *   node --env-file=.env node_modules/.bin/vite-node --config scripts/vite-node.config.ts \
 *     scripts/backfill-signed-url-nodes.ts -- --dry-run
 *   node --env-file=.env node_modules/.bin/vite-node --config scripts/vite-node.config.ts \
 *     scripts/backfill-signed-url-nodes.ts -- --apply
 */
import { createServiceRoleDb } from '$lib/server/db/client';

const BACKFILL_SIGNED_URL_NODES_USE = {
  path: 'scripts/backfill-signed-url-nodes.ts',
  why: 'Uno script una tantum, senza sessione utente: attraversa `nodes` di ogni org per trovare le righe con un url firmato scritto per errore in `data` (bug risolto in codice), cosa che nessun JWT di una singola org potrebbe fare.',
  tables: ['nodes'] as const
};

const SIGNED_STORAGE_URL = '/storage/v1/object/sign/';

type BrokenNode = {
  id: string;
  project_id: string;
  version: number;
  data: Record<string, unknown>;
};

async function findBrokenNodes(db: ReturnType<typeof createServiceRoleDb>): Promise<BrokenNode[]> {
  const { data, error } = await db
    .from('nodes')
    .select('id, project_id, version, data')
    .is('deleted_at', null)
    .not('data->>assetId', 'is', null)
    .is('data->>refId', null)
    .like('data->>url', `%${SIGNED_STORAGE_URL}%`);

  if (error) {
    throw new Error(`lettura nodes fallita: ${error.message}`);
  }

  return (data ?? []) as BrokenNode[];
}

async function applyFix(
  db: ReturnType<typeof createServiceRoleDb>,
  node: BrokenNode
): Promise<'updated' | 'skipped'> {
  const { url: _drop, ...rest } = node.data;
  const nextData = { ...rest, refId: node.data.assetId };

  const { data, error } = await db
    .from('nodes')
    .update({ data: nextData, version: node.version + 1 })
    .eq('id', node.id)
    .eq('version', node.version)
    .select('id');

  if (error) {
    throw new Error(`update nodo ${node.id} fallito: ${error.message}`);
  }

  return (data ?? []).length > 0 ? 'updated' : 'skipped';
}

async function main() {
  const apply = process.argv.includes('--apply');
  const db = createServiceRoleDb(BACKFILL_SIGNED_URL_NODES_USE);

  const broken = await findBrokenNodes(db);
  console.log(`nodi con url firmato persistito: ${broken.length}`);
  for (const node of broken.slice(0, 10)) {
    console.log(`  - node ${node.id} (project ${node.project_id}, version ${node.version})`);
  }

  if (!apply) {
    console.log('dry-run: nessuna scrittura. Rilancia con --apply per correggere.');
    return;
  }

  let updated = 0;
  let skipped = 0;
  for (const node of broken) {
    const outcome = await applyFix(db, node);
    if (outcome === 'updated') {
      updated += 1;
    } else {
      skipped += 1;
      console.log(`  saltato per conflitto di versione: node ${node.id}`);
    }
  }

  console.log(`corretti: ${updated}, saltati per conflitto: ${skipped}, trovati: ${broken.length}`);
}

main().catch((cause) => {
  console.error(cause);
  process.exitCode = 1;
});
