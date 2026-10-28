import { loadSession } from '../lib/auth.ts';
import { callEndpoint } from '../lib/api.ts';
import { GET_BRAND_LIBRARY } from '../lib/contracts/index.ts';
import { table, c } from '../lib/display.ts';

type Item = { id: string; title: string; subtitle: string | null; mediaType: string | null; group?: string };

const TABS = ['kit', 'products', 'posts', 'ads'];

export async function cmdLibrary(slug: string, tab: string) {
  const session = await loadSession();
  if (!session) { console.error('Sessione scaduta o non trovata. Esegui: feega login'); process.exit(1); }
  if (!TABS.includes(tab)) { console.error(`Tab sconosciuta: ${tab}. Usa ${TABS.join(', ')}.`); process.exit(1); }

  const { items } = await callEndpoint<{ items: Item[] }>(GET_BRAND_LIBRARY, session.access_token, slug, { tab });
  if (!items.length) {
    console.log(c.dim('Niente qui.'));
    return;
  }

  table(
    ['Group', 'Title', 'Detail', 'Media'],
    items.map((i) => [i.group ?? '', c.bold(i.title), c.dim(i.subtitle ?? ''), i.mediaType ?? ''])
  );
}
