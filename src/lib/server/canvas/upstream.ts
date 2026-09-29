import type { Db } from '$lib/server/db/client';
import { listConnections, listNodes, type CanvasNodeRecord, type Connection } from '$lib/server/repos/canvas';
import { findAsset, findAssets } from '$lib/server/repos/assets';
import { listInfluencerViews, signInfluencerViewFiles } from '$lib/server/repos/influencers';
import { findReferenceImages, signReferenceImages } from '$lib/server/repos/reference-images';
import { referencesOf } from '$lib/canvas/node-references';
import { syncedSourceItems } from './synced-items';
import {
  resolveUpstreamInputs,
  type UpstreamEdge,
  type UpstreamInputs,
  type UpstreamNode
} from '$lib/canvas/upstream-inputs';
import type { Modalities } from '$lib/canvas/connectors';
import { AUDIO_INPUT_MODALITIES } from '$lib/canvas/audio-operations';
import { isSelectableSourceType } from '$lib/canvas/select-node';
import type { SelectableItem } from '$lib/canvas/select-sources';
import {
  isListItemKind,
  listValues,
  wiredKindOf,
  wiresInto,
  type ListItem,
  type ListItemKind,
  type ListValues,
  type WiredListSource
} from '$lib/canvas/list-node';

/**
 * DAL DATABASE ALLA FORMA PURA CHE `upstream-inputs.ts` LEGGE.
 *
 * `resolveUpstreamInputs` non sa cosa sia un `Db`: prende nodi, archi e le modalità del modello
 * scelto già risolte. Questo file è l'unico punto che parla al database per farglieli — legge la
 * tela una volta, poi chiede lo stesso testo da monte a ogni giro. `generate.ts` chiama SOLO
 * questa funzione: la forma della query resta qui, non in mezzo alla logica che genera.
 *
 * IL TESTO SORGENTE È `data.refId` → `assets.content` per un nodo che genera, con `data.prompt`
 * come riserva quando non ha ancora girato — un testo mai generato dà comunque quel che c'è
 * scritto, invece di sparire dal giro a valle. Per un `doc` è `data.content`: la stessa coppia che
 * `canvas-node-data.ts::genOf`/`docOf` legge lato client, perché client e server devono vedere lo
 * stesso nodo nello stesso modo.
 *
 * UN MODELLO SPARITO DA `ai_models` BLOCCA IL NODO, PRIMA di risolvere qualunque cosa — non un
 * arco alla volta, il nodo intero: `modalitiesOf` che torna `null` qui non è "non ancora
 * sincronizzato" (quel caso non può più accadere — il selettore offre solo modelli con una riga
 * sincronizzata, decisione di prodotto), è un modello che C'ERA e ora `ai_models` non conferma
 * più. Chiedere al provider lo scoprirebbe comunque, dopo aver speso la latenza e forse il costo
 * della chiamata: qui si rifiuta PRIMA, con la stessa ragione che l'alert nel nodo può mostrare.
 * Il prompt, gli archi e il risultato precedente del nodo non li tocca nessuno — `blocked` ferma
 * solo la PROSSIMA generazione, la stessa disciplina che tiene `giveUp()` in `generate.ts` lontano
 * dal cancellare un `refId` prima di sapere l'esito.
 *
 * `model` QUI È IL NOSTRO ID INTERNO (`gpt-image-2.5-flare`), non l'id sul filo di OpenRouter
 * (`openai/gpt-image-2.5-flare`): `modalitiesOf` con un `catalogue` lo traduce da sé
 * (`wireModelId`, in `ai-models-sync.ts`) — lo stesso spec che `offerable-models.ts` legge per
 * decidere cosa offrire, non una seconda copia della stessa tabella.
 */
async function modalitiesFor(model: string, medium: 'image' | 'video'): Promise<Modalities | null> {
  const { modalitiesOf } = await import('$lib/server/ai-models-sync');
  const { createAdminClient } = await import('$lib/server/supabase-admin');
  const modalities = await modalitiesOf(createAdminClient(), model, medium);
  return modalities ? { input: modalities.input, uncensored: modalities.uncensored } : null;
}

/**
 * LE PORTE DI UN NODO TESTO OLTRE A QUELLA FISSA vengono dallo stesso listino `ai_models` di
 * immagine/video (`catalogue: 'chat'`), ma un modello di testo non ancora sincronizzato NON
 * BLOCCA il nodo come farebbe `modalitiesFor` per immagine/video — `canvas-catalogue.ts` lo
 * dichiara già: il testo non ha un equivalente della regola "non sincronizzato, non offerto",
 * il centralino risponde comunque. `{ input: [] }` qui significa solo "nessuna porta oltre al
 * testo", mai "questo nodo non può girare".
 */
async function textModalitiesFor(model: string): Promise<Modalities> {
  const { modalitiesOf } = await import('$lib/server/ai-models-sync');
  const { createAdminClient } = await import('$lib/server/supabase-admin');
  const modalities = await modalitiesOf(createAdminClient(), model, 'chat');
  return { input: modalities?.input ?? [] };
}

function sourceText(node: CanvasNodeRecord, asset: { content: string | null } | null): string | null {
  if (node.type === 'doc') {
    const content = node.data.content;
    return typeof content === 'string' && content.trim() ? content : null;
  }
  if (asset?.content) {
    return asset.content;
  }
  const prompt = node.data.prompt;
  return typeof prompt === 'string' && prompt.trim() ? prompt : null;
}

function sourceMediaUrl(asset: { url: string | null } | null): string | null {
  return asset?.url ?? null;
}

/**
 * LE VISTE DI UN NODO `influencer`, GIÀ NELL'ORDINE GIUSTO — `listInfluencerViews` ordina per
 * `sort_order`, questo file non riordina niente: `resolveUpstreamInputs` consuma `mediaUrls`
 * com'è, come il suo stesso commento dichiara. Un influencer senza `influencer_id` valido (una
 * riga malformata, mai dovrebbe accadere dopo `validateNodeData`) torna un elenco vuoto — lo
 * stesso "niente da dare" di un nodo mai girato, non un errore che ferma la tela.
 */
async function influencerMediaUrls(db: Db, node: CanvasNodeRecord): Promise<string[]> {
  const influencerId = typeof node.data.influencer_id === 'string' ? node.data.influencer_id : null;
  if (!influencerId) return [];

  const views = await listInfluencerViews(db, influencerId);
  if (!views.length) return [];

  const signed = await signInfluencerViewFiles(db, views.map((v) => v.storagePath));
  return views.map((v) => signed.get(v.storagePath)).filter((url): url is string => Boolean(url));
}

function listOfRow(node: CanvasNodeRecord): { itemKind: ListItemKind; items: ListItem[] } {
  const kind = typeof node.data.item_kind === 'string' && isListItemKind(node.data.item_kind) ? node.data.item_kind : 'image';
  const items = Array.isArray(node.data.items) ? (node.data.items as ListItem[]) : [];
  return { itemKind: kind, items };
}

/** L'output di ORA di un nodo collegato a una lista: l'asset del suo ultimo giro per un'immagine,
 *  il testo (generato, o il prompt) per un testo — `sourceText`, la stessa regola di ogni altro filo. */
async function wiredItem(db: Db, orgId: string, node: CanvasNodeRecord, kind: ListItemKind): Promise<ListItem | null> {
  const refId = typeof node.data.refId === 'string' ? node.data.refId : null;
  const asset = refId ? await findAsset(db, { orgId, assetId: refId }) : null;

  if (kind === 'text') {
    const text = sourceText(node, asset);
    return text ? { text } : null;
  }
  return asset?.url ? { asset_id: refId!, url: asset.url } : null;
}

/**
 * I VALORI DI UNA LISTA LATO SERVER: gli item a mano più l'output vivo di ogni nodo collegato,
 * attraverso `listValues` — la stessa funzione pura che la tile legge. Un loop, un `select` e un
 * filo `fixed` passano tutti da qui, mai da `data.items` da soli.
 */
export async function resolvedListValues(
  db: Db,
  orgId: string,
  list: CanvasNodeRecord,
  connections: Connection[],
  nodesById: Map<string, CanvasNodeRecord>
): Promise<ListValues> {
  const wired: WiredListSource[] = [];
  for (const edge of wiresInto(list.id, connections)) {
    const source = nodesById.get(edge.sourceNodeId);
    const kind = source ? wiredKindOf(source.type) : null;
    if (!source || !kind) continue;
    wired.push({ nodeId: source.id, kind, item: await wiredItem(db, orgId, source, kind) });
  }
  return listValues(listOfRow(list), wired);
}

/**
 * Un `asset_id` di un item a mano si risolve con `findAssets`, in un giro solo per tutta la lista;
 * un item che porta già `url` (un filo, o trascinato da fuori la libreria) non ne ha bisogno.
 */
function itemMediaUrl(item: ListItem, assetsById: Map<string, { url: string | null }>): string | null {
  if (item.url) return item.url;
  if (!item.asset_id) return null;
  return assetsById.get(item.asset_id)?.url ?? null;
}

async function resolveItemAssets(db: Db, orgId: string, items: ListItem[]) {
  const ids = items.filter((item) => !item.url).map((item) => item.asset_id).filter((id): id is string => Boolean(id));
  return findAssets(db, { orgId, assetIds: ids });
}

/** Ogni valore di una lista, risolto — TUTTI, per un filo `fixed`: la stessa dottrina di
 *  `influencerMediaUrls`, un `list` collegato senza `iterate` alimenta con ogni valore. */
async function listMediaUrls(db: Db, orgId: string, values: ListValues): Promise<string[]> {
  const items = values.values.map((v) => v.item);
  const assetsById = await resolveItemAssets(db, orgId, items);
  return items.map((item) => itemMediaUrl(item, assetsById)).filter((url): url is string => Boolean(url));
}

function listTexts(values: ListValues): string[] {
  return values.values.map((v) => v.item.text).filter((t): t is string => Boolean(t?.trim()));
}

/**
 * IL NODO CHE ALIMENTA QUESTO `select`, O NULL QUANDO LA REFERENZA È ROTTA — cancellato, mai stato
 * collegato, o collegato a qualcosa che non è una sorgente selezionabile. `select` prende SOLO dal
 * primo arco entrante la cui sorgente è in `SELECTABLE_SOURCE_TYPES` (`select-node.ts`, la stessa
 * tabella che il client legge): la stessa disciplina deterministica di
 * `upstream-inputs.ts::incomingEdges`, applicata qui perché un `select` ha senso con un solo
 * upstream — sceglierne uno fra due sorgenti diverse non è un caso che il prodotto definisce.
 */
function listFeeding(node: CanvasNodeRecord, connections: Connection[], nodesById: Map<string, CanvasNodeRecord>): CanvasNodeRecord | null {
  const incoming = connections
    .filter((c) => c.targetNodeId === node.id)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  for (const edge of incoming) {
    const source = nodesById.get(edge.sourceNodeId);
    if (source && isSelectableSourceType(source.type)) return source;
  }
  return null;
}

/** L'item scelto (1-based) di un `products`/`social_account_feed`, come lo legge sia un `select`
 *  che un'iterazione di loop su quello stesso nodo — la stessa domanda di `itemAt` per una `list`,
 *  sulla stessa `SelectableItem[]` che `syncedSourceItems` costruisce. */
function syncedItemAt(items: SelectableItem[], index: number): SelectableItem | null {
  return index >= 1 && index <= items.length ? items[index - 1] : null;
}

/**
 * IL VALORE DI UNA LISTA ALL'INDICE DATO (1-based), risolto a testo o url — la stessa domanda che
 * `select` fa sulla propria lista a monte, e che un'iterazione di loop fa su un asse `iterate`:
 * un indice fuori range o una lista vuota tornano "niente da dare", mai un valore a caso.
 */
async function itemAt(db: Db, orgId: string, values: ListValues, index: number): Promise<{ text: string | null; mediaUrl: string | null }> {
  const item = index >= 1 && index <= values.values.length ? values.values[index - 1].item : null;
  if (!item) return { text: null, mediaUrl: null };

  if (values.itemKind === 'text') {
    return { text: item.text?.trim() ? item.text : null, mediaUrl: null };
  }
  const assetsById = await resolveItemAssets(db, orgId, [item]);
  return { text: null, mediaUrl: itemMediaUrl(item, assetsById) };
}

async function toUpstreamNode(
  db: Db,
  orgId: string,
  node: CanvasNodeRecord,
  connections: Connection[],
  nodesById: Map<string, CanvasNodeRecord>,
  iterateSelection: Record<string, number> = {}
): Promise<UpstreamNode> {
  if (node.type === 'influencer') {
    return {
      id: node.id,
      type: node.type,
      model: null,
      text: null,
      mediaUrl: null,
      mediaUrls: await influencerMediaUrls(db, node)
    };
  }

  if (node.type === 'list') {
    const values = await resolvedListValues(db, orgId, node, connections, nodesById);
    const medium = values.itemKind === 'text' ? 'text' : 'image';

    // UN'ITERAZIONE DI LOOP VEDE UN VALORE SOLO — quando questo nodo è nella mappa, si risolve come
    // farebbe un `select` su se stesso a quell'indice, non con l'intera lista (il comportamento
    // `fixed`, invariato quando la mappa non lo nomina).
    if (node.id in iterateSelection) {
      const value = await itemAt(db, orgId, values, iterateSelection[node.id]);
      return { id: node.id, type: node.type, medium, model: null, text: value.text, mediaUrl: value.mediaUrl };
    }

    if (values.itemKind === 'text') {
      return { id: node.id, type: node.type, medium, model: null, text: listTexts(values).join('\n\n') || null, mediaUrl: null };
    }
    return { id: node.id, type: node.type, medium, model: null, text: null, mediaUrl: null, mediaUrls: await listMediaUrls(db, orgId, values) };
  }

  if (node.type === 'products' || node.type === 'social_account_feed') {
    const items = await syncedSourceItems(db, orgId, node);

    // UN'ITERAZIONE DI LOOP VEDE UN VALORE SOLO — la stessa dottrina di `list` sopra, sulla stessa
    // `SelectableItem[]` che un `select` su questo nodo leggerebbe.
    if (node.id in iterateSelection) {
      const item = syncedItemAt(items, iterateSelection[node.id]);
      return {
        id: node.id,
        type: node.type,
        medium: item?.mediaUrls.length ? 'image' : 'text',
        model: null,
        text: item?.text ?? null,
        mediaUrl: item?.mediaUrls[0] ?? null,
        mediaUrls: item?.mediaUrls ?? []
      };
    }

    return { id: node.id, type: node.type, medium: 'text', model: null, text: null, mediaUrl: null };
  }

  if (node.type === 'select') {
    const source = listFeeding(node, connections, nodesById);
    if (!source) return { id: node.id, type: node.type, medium: 'image', model: null, text: null, mediaUrl: null };

    const index = typeof node.data.index === 'number' ? node.data.index : 0;

    if (source.type === 'products' || source.type === 'social_account_feed') {
      const items = await syncedSourceItems(db, orgId, source);
      const item = syncedItemAt(items, index);
      const medium = item?.mediaUrls.length ? 'image' : 'text';
      return {
        id: node.id,
        type: node.type,
        medium,
        model: null,
        text: item?.text ?? null,
        mediaUrl: item?.mediaUrls[0] ?? null,
        mediaUrls: item?.mediaUrls ?? []
      };
    }

    const values = await resolvedListValues(db, orgId, source, connections, nodesById);
    const value = await itemAt(db, orgId, values, index);
    return { id: node.id, type: node.type, medium: values.itemKind === 'text' ? 'text' : 'image', model: null, text: value.text, mediaUrl: value.mediaUrl };
  }

  const refId = typeof node.data.refId === 'string' ? node.data.refId : null;
  const asset = refId ? await findAsset(db, { orgId, assetId: refId }) : null;

  return {
    id: node.id,
    type: node.type,
    model: typeof node.data.model === 'string' ? node.data.model : null,
    text: sourceText(node, asset),
    mediaUrl: sourceMediaUrl(asset)
  };
}

async function pickedReferenceUrls(db: Db, orgId: string, node: CanvasNodeRecord): Promise<string[]> {
  const refs = referencesOf(node.data);
  if (!refs.length) {
    return [];
  }

  const idsOf = (source: string) => refs.filter((r) => r.source === source).map((r) => r.id);
  const [assets, catalogue] = await Promise.all([
    findAssets(db, { orgId, assetIds: idsOf('asset') }),
    findReferenceImages(db, idsOf('catalogue'))
  ]);
  const signed = await signReferenceImages(db, [...catalogue.values()].map((image) => image.storagePath));

  const urlOf = {
    asset: (id: string) => assets.get(id)?.url ?? null,
    catalogue: (id: string) => {
      const image = catalogue.get(id);
      return image ? (signed.get(image.storagePath) ?? null) : null;
    }
  };
  return refs.map((ref) => urlOf[ref.source](ref.id)).filter((url): url is string => Boolean(url));
}

function toUpstreamEdge(connection: Connection): UpstreamEdge {
  return {
    id: connection.id,
    sourceNodeId: connection.sourceNodeId,
    targetNodeId: connection.targetNodeId,
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle
  };
}

const BLOCKED_EMPTY: Omit<UpstreamInputs, 'blocked'> = {
  text: [],
  referenceImageUrl: null,
  referenceImageUrls: [],
  pickedImageUrls: [],
  referenceVideoUrls: [],
  referenceAudioUrls: [],
  startFrameUrl: null,
  endFrameUrl: null,
  rejected: []
};

/**
 * QUEL CHE `nodeId` RICEVE DA CHI GLI È COLLEGATO SU QUESTA TELA, ADESSO. Una lettura di `nodes`
 * e `nodes_connections`, poi l'asset di ogni sorgente che ne ha uno: N+1 sugli asset, accettabile
 * perché una tela ha decine di nodi, non migliaia, e la generazione stessa costa molto di più di
 * questa lettura.
 */
export async function upstreamInputsFor(
  db: Db,
  scope: {
    orgId: string;
    canvasId: string;
    nodeId: string;
    model?: string | null;
    medium?: 'text' | 'image' | 'video' | 'audio';
    /** Un'iterazione di loop (`loop.ts`): quale item (1-based) di ogni `list` nominata qui vede
     *  QUESTA chiamata, invece della lista intera. Assente = comportamento `fixed`, invariato. */
    iterateSelection?: Record<string, number>;
  }
): Promise<UpstreamInputs> {
  const checkable = scope.model && (scope.medium === 'image' || scope.medium === 'video');
  const modalities = checkable ? await modalitiesFor(scope.model!, scope.medium as 'image' | 'video') : null;

  if (checkable && !modalities) {
    return {
      ...BLOCKED_EMPTY,
      blocked: `${scope.model} non è più fra i modelli sincronizzati da OpenRouter — scegli un altro modello per continuare`
    };
  }

  const resolvedModalities =
    modalities ??
    (scope.medium === 'audio' ? { input: AUDIO_INPUT_MODALITIES } : null) ??
    (scope.medium === 'text' && scope.model ? await textModalitiesFor(scope.model) : null);

  const [nodeRows, connectionRows] = await Promise.all([
    listNodes(db, { orgId: scope.orgId, canvasId: scope.canvasId }),
    listConnections(db, { orgId: scope.orgId, canvasId: scope.canvasId })
  ]);

  const nodesById = new Map(nodeRows.map((n) => [n.id, n]));
  const iterateSelection = scope.iterateSelection ?? {};
  const nodes = await Promise.all(
    nodeRows.map((n) => toUpstreamNode(db, scope.orgId, n, connectionRows, nodesById, iterateSelection))
  );
  const edges = connectionRows.map(toUpstreamEdge);

  const target = nodesById.get(scope.nodeId);
  const referenceUrls = target ? await pickedReferenceUrls(db, scope.orgId, target) : [];
  const withPicked = nodes.map((n) => (n.id === scope.nodeId ? { ...n, referenceUrls } : n));

  return resolveUpstreamInputs(withPicked, edges, scope.nodeId, resolvedModalities ?? { input: [] });
}
