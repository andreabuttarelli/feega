/**
 * COSA DIVENTA UN NODO QUANDO ARRIVA TRASCINATO DA FUORI LA TELA — dalla libreria degli asset. Una tabella sola, non un `if` per ogni pannello che trascina qualcosa:
 * `DRAG_NODE_KIND` risponde "che tipo di nodo nasce" per ogni origine, e le funzioni sotto
 * costruiscono `data` già nella forma che `nodes_data_shape_check` (vedi la migration
 * `20260922_jsonb_check_constraints.sql`) e gli zod di `node-data.ts` accettano.
 *
 * UN NODO STATICO, NON GENERATO. Un'immagine o un video trascinati prendono `type: 'image'`
 * o `type: 'video'` con `data.assetId` valorizzato — lo stesso discriminante di
 * `uploaded-node.ts::isUploadedNodeRow`: un upload e un drag sono la stessa cosa sulla tela,
 * un file che esiste già, non un prompt da far girare. `prompt: ''` soddisfa il CHECK, che per
 * `image`/`video` chiede solo quello — `assetId` non è nel CHECK apposta (vedi il commento in
 * `uploaded-node.ts`), ma è lui a far apparire il tag "caricato" invece del pulsante "Genera".
 */
import { genNodeSize } from './gen-node';
import { docNodeSize } from './doc-node';

export type DragAssetKind = 'image' | 'video' | 'document';

export const DRAG_NODE_KIND: {
  asset: Record<DragAssetKind, 'image' | 'video' | 'doc'>;
} = {
  asset: {
    image: 'image',
    video: 'video',
    document: 'doc'
  }
};

export type StaticImageOrVideoData = {
  prompt: '';
  assetId: string;
  name: string;
  mimeType: string;
};

/**
 * `url` NON ENTRA IN `data`: un URL firmato scade (due ore), e `nodes.data` è ciò che sopravvive
 * a una ricarica. `assetId` è il riferimento stabile — la tela lo rifirma da capo a ogni lettura
 * (`assetUrl`/`signAssetPaths`), la stessa dottrina di `refId` sui nodi che generano.
 */
export function staticMediaData(input: {
  assetId: string;
  url: string;
  name: string;
  mimeType: string;
}): StaticImageOrVideoData {
  return { prompt: '', assetId: input.assetId, name: input.name, mimeType: input.mimeType };
}

export type StaticDocData = { content: string; public: false };

export function staticDocData(content: string): StaticDocData {
  return { content, public: false };
}

export type InfluencerData = { influencer_id: string };

export function influencerNodeData(influencerId: string): InfluencerData {
  return { influencer_id: influencerId };
}

/** Alto quanto un'immagine (`genNodeSize('image')`): un influencer mostra un volto, non testo. */
const INFLUENCER_NODE_SIZE = { w: 360, h: 460 };

export function influencerNodeSize(): { w: number; h: number } {
  return { ...INFLUENCER_NODE_SIZE };
}

/**
 * IL TIPO MIME CON CUI UN NODO GIÀ PIENO VIAGGIA DA FUORI LA TELA — dalla libreria asset o dalla
 * lista brand, un `dragstart` su una card, non sul menù `+` della tela. `CANVAS_DRAG_MEDIUM`
 * (`new-node.ts`) porta solo un nome di tipo (`Addable`) e la tela lo trasforma in un nodo VUOTO
 * (`newNodeRow`); qui invece il nodo nasce PIENO — un asset che esiste già, non
 * un prompt da scrivere. Un MIME diverso, non un payload più ricco sullo stesso: la tela di oggi
 * (`CanvasFlow.svelte::onDrop`) ignora un tipo che non riconosce, quindi finché il suo handler
 * non legge anche questo, un file trascinato qui non fa niente — non crea un nodo vuoto per
 * sbaglio, che sarebbe peggio di un trascinamento che non funziona ancora.
 */
export const CANVAS_DRAG_FILLED_NODE = 'application/x-feega-filled-node';
export const CANVAS_DRAG_OUTPUT = 'application/x-feega-node-output';

export type FilledNodeDrag = {
  type: 'image' | 'video' | 'model3d' | 'text' | 'doc' | 'influencer' | 'social_account_feed' | 'iframe';
  data: Record<string, unknown>;
  w: number;
  h: number;
};

/**
 * LO STESSO PACCHETTO, DA UNA RIGA DI ASSET — non riscritto a ogni pannello
 * che trascina. Prima viveva dentro `dragstart` di `assets/+page.svelte`; la sidebar del progetto
 * (`ProjectDragPanel`) è il secondo posto da cui la stessa card parte, e una seconda copia sarebbe la regola sparsa che CLAUDE.md chiede di non
 * scrivere. `null` quando non c'è niente da mettere nel nodo — un asset senza url firmato — non un nodo che nasce e si scopre rotto al primo sguardo.
 */
export function assetDrag(item: {
  type: string;
  id: string;
  signedUrl: string | null;
  url: string | null;
  mimeType: string | null;
  content: string | null;
}): FilledNodeDrag | null {
  if (item.type === 'image' || item.type === 'video') {
    if (!item.signedUrl) return null;
    const nodeType = item.type;
    return {
      type: nodeType,
      data: staticMediaData({
        assetId: item.id,
        url: item.signedUrl,
        name: item.url?.split('/').pop() ?? item.id,
        mimeType: item.mimeType ?? ''
      }),
      ...genNodeSize(nodeType)
    };
  }

  if (item.type === 'document') {
    return { type: 'doc', data: staticDocData(item.content ?? ''), ...docNodeSize() };
  }

  return null;
}

/**
 * UN INFLUENCER TRASCINATO DAL PANNELLO — di catalogo o proprio dell'org, la stessa card in
 * entrambi i casi: il nodo porta solo `influencer_id`, le viste il server le legge da
 * `influencer_views` quando la tila si disegna (`InfluencerNode.svelte`), la stessa dottrina dei nodi sincronizzati. Nessun caso `null`: un influencer esiste già per costruzione, a differenza di un
 * asset senza url firmato.
 */
export function influencerDrag(influencer: { id: string }): FilledNodeDrag {
  return { type: 'influencer', data: influencerNodeData(influencer.id), ...influencerNodeSize() };
}

export function serializeFilledNodeDrag(drag: FilledNodeDrag): string {
  return JSON.stringify(drag);
}

const FILLED_NODE_DRAG_TYPES = new Set<FilledNodeDrag['type']>([
  'image',
  'video',
  'model3d',
  'text',
  'doc',
  'influencer',
  'social_account_feed',
  'iframe'
]);

export function parseFilledNodeDrag(raw: string): FilledNodeDrag | null {
  try {
    const parsed = JSON.parse(raw) as Partial<FilledNodeDrag>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.type || !FILLED_NODE_DRAG_TYPES.has(parsed.type)) return null;
    if (!parsed.data || typeof parsed.data !== 'object') return null;
    if (typeof parsed.w !== 'number' || typeof parsed.h !== 'number') return null;
    return { type: parsed.type, data: parsed.data, w: parsed.w, h: parsed.h };
  } catch {
    return null;
  }
}
