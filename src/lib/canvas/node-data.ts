/**
 * LA FORMA DI `nodes.data`, UNA RIGA PER TIPO — l'eccezione che `graph.ts` chiede: dichiarata in
 * un posto solo, accanto al modello che la governa, così il tipo dodicesimo è una riga e non un
 * `if` sparso in cinque file.
 *
 * `nodes.type` ha un CHECK (`nodes_type_check`, vedi `org-data/checks.ts`) che ammette 12 valori.
 * Il CHECK ferma il `type` sbagliato; `data` è `jsonb` e Postgres accetta qualunque JSON — nessun
 * vincolo lo controlla. Un agente che chiama `insert_row('nodes', …)` doveva INDOVINARE la forma:
 * questo file è quella forma, e `validateNodeData` è la funzione che la applica.
 *
 * I LIMITI DEL MODELLO NON VIVONO QUI. Aspect ratio, durate, tetto del prompt sono fatti del
 * MODELLO scelto (`media-model-slots`, `get_media_models`): duplicarli in questo schema darebbe
 * due verità che divergono, e un rifiuto scoperto dopo aver pagato. Per questo `aspect_ratio`,
 * `resolution`, `duration` sono stringhe/numeri liberi qui — il catalogo del modello li giudica,
 * non questo file.
 *
 * QUESTO FILE VIVE IN `src/lib/canvas/`, non in `org-data/`: la validazione deve essere IDENTICA
 * per l'app (quando scriverà `nodes` direttamente) e per l'MCP (`insert_row`/`update_row` via
 * `write-tool.ts`) — un pacchetto solo, letto da entrambi, invece di due copie che divergono al
 * primo campo aggiunto.
 */
import { z } from 'zod';
import { mergeNodeData, type NodeData } from './node-patch';
import { SOCIAL_PLATFORMS } from './social-platforms';
import { FEED_MEDIA, FEED_SORTS, PRODUCT_SORTS } from './source-filters';
import { EFFECTS } from './effects';
import { nodeReferenceSchema } from './node-references';
import type { EffectId, EffectParam } from './effects';
import { LAYOUTS } from './composition/index';
import { CAMERA_PRESETS } from './composition/camera';
import type { LayoutId } from './composition/types';
import type { CameraPresetId } from './composition/camera';
import { CALENDAR_VIEWS } from '$lib/calendar/period-grid';
import { CALENDAR_SCOPES } from './calendar-node';
import { AUDIO_OPERATION_IDS, type AudioOperationId } from './audio-operations';
import { MAX_CUSTOM_OUTPUTS, MAX_OUTPUT_LABEL } from './select-outputs';
import { SOURCE_ITEM_FIELDS } from './select-sources';

/** Lo stato di una generazione lunga: gli stessi campi per i tre tipi che generano davvero. */
const GEN_STATUS = ['idle', 'running', 'done', 'failed'] as const;

const genState = {
  status: z.enum(GEN_STATUS).optional(),
  run_id: z.string().optional(),
  error: z.string().nullable().optional(),
  output_asset_id: z.string().optional(),
  started_at: z.string().optional(),
  finished_at: z.string().optional(),
  cost_usd: z.number().optional()
};

/**
 * Lo stato di una SINCRONIZZAZIONE: gli stessi campi per `products` e `social_account_feed`, i
 * due nodi che non generano ma scaricano. Non è `genState` — non c'è un `run_id` da rincorrere
 * su un provider asincrono, il giro finisce dentro la stessa richiesta — ma la forma "in corso /
 * fatto / fallito con un motivo leggibile" è la stessa idea, ed è per questo che vive qui accanto
 * e non duplicata due volte.
 */
const syncState = {
  sync_status: z.enum(GEN_STATUS).optional(),
  sync_error: z.string().nullable().optional(),
  synced_count: z.number().optional(),
  synced_at: z.string().nullable().optional(),
  sync_summary: z.string().nullable().optional()
};

const textSchema = z.object({
  system_prompt: z.string().optional(),
  prompt: z.string(),
  model: z.string().nullable().optional(),
  reasoning: z.string().optional(),
  ...genState
});

const libraryMedia = {
  assetId: z.string().optional(),
  url: z.string().optional(),
  name: z.string().optional(),
  mimeType: z.string().optional()
};

const imageSchema = z.object({
  prompt: z.string(),
  model: z.string().nullable().optional(),
  aspect_ratio: z.string().optional(),
  resolution: z.string().optional(),
  references: z.array(nodeReferenceSchema).optional(),
  ...genState,
  ...libraryMedia
});

const videoSchema = z.object({
  prompt: z.string(),
  model: z.string().nullable().optional(),
  audio: z.boolean().optional(),
  aspect_ratio: z.string().optional(),
  resolution: z.string().optional(),
  references: z.array(nodeReferenceSchema).optional(),
  ...genState,
  ...libraryMedia
});

const audioSchema = z.object({
  prompt: z.string(),
  model: z.string().nullable().optional(),
  params: z
    .object({
      operation: z.enum(AUDIO_OPERATION_IDS as [AudioOperationId, ...AudioOperationId[]]).optional(),
      voiceId: z.string().optional(),
      voiceName: z.string().optional(),
      targetLanguage: z.string().optional(),
      duration: z.number().optional(),
      stability: z.number().min(0).max(1).optional(),
      similarity: z.number().min(0).max(1).optional(),
      style: z.number().min(0).max(1).optional()
    })
    .optional(),
  ...genState,
  ...libraryMedia
});

const docSchema = z.object({
  content: z.string(),
  public: z.boolean()
});

/**
 * Stessa protezione di `iframe-node.ts::normalizeEmbedUrl`: solo `http:`/`https:`. `javascript:`
 * eseguirebbe sull'origine di chi incorpora, `data:` porterebbe un documento arbitrario, `file:`
 * punterebbe al disco di chi guarda — nessuno dei tre ha un uso legittimo su questo campo.
 */
const EMBEDDABLE_PROTOCOLS = ['http:', 'https:'];

function isEmbeddableUrl(raw: string): boolean {
  try {
    return EMBEDDABLE_PROTOCOLS.includes(new URL(raw).protocol);
  } catch {
    return false;
  }
}

const iframeSchema = z
  .object({
    url: z.string().refine(isEmbeddableUrl, { message: 'solo indirizzi http e https' }).optional(),
    content: z.string().optional()
  })
  .refine((v) => Boolean(v.url) || Boolean(v.content), {
    message: 'needs a url or content: an embed with neither shows nothing'
  });

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();

const feedFiltersSchema = z.object({
  from: isoDay,
  to: isoDay,
  media: z.enum(FEED_MEDIA).optional(),
  min_likes: z.number().nonnegative().nullable().optional(),
  min_views: z.number().nonnegative().nullable().optional(),
  include: z.string().optional(),
  exclude: z.string().optional(),
  sort: z.enum(FEED_SORTS).optional()
});

const productFiltersSchema = z.object({
  query: z.string().optional(),
  price_min: z.number().nonnegative().nullable().optional(),
  price_max: z.number().nonnegative().nullable().optional(),
  in_stock_only: z.boolean().optional(),
  sort: z.enum(PRODUCT_SORTS).optional()
});

const socialAccountFeedSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  handle: z.string(),
  limit: z.number().int().positive().optional(),
  after: z.string().nullable().optional(),
  filters: feedFiltersSchema.optional(),
  ...syncState
});

const mockupPost = z.object({
  caption: z.string().optional(),
  media: z.array(z.unknown()).optional()
});

const socialPostMockupSchema = z.object({
  general: z
    .object({
      caption: z.string().optional(),
      media: z.array(z.unknown()).optional(),
      first_comment: z.string().nullable().optional()
    })
    .optional(),
  x: z.object({ posts: z.array(mockupPost) }).optional(),
  threads: z.object({ posts: z.array(mockupPost) }).optional()
});

/** Gli stessi valori di `products_platform_check`. */
const PRODUCT_PLATFORMS = ['shopify', 'woocommerce'] as const;

const productsSchema = z.object({
  type: z.enum(PRODUCT_PLATFORMS),
  url: z.union([z.literal(''), z.string().url()]),
  limit: z.number().int().positive().optional(),
  after: z.string().nullable().optional(),
  only_first_photo: z.boolean().optional(),
  category: z.string().optional(),
  filters: productFiltersSchema.optional(),
  ...syncState
});

/**
 * Due modi, un solo `mode`. Il CHECK non può imporre «page_id quando mode=page»: è codice, non
 * schema — la stessa scelta che `NEW_DATABASE_STRUCTURE.md` propone e che qui si applica con
 * `superRefine`, l'unico posto dove la coppia resta onesta.
 */
const adsBase = z.object({
  mode: z.enum(['page', 'search']),
  page_id: z.string().optional(),
  page_name: z.string().optional(),
  search_terms: z.string().optional(),
  country: z.string().min(2),
  active_only: z.boolean().optional(),
  limit: z.number().int().positive().optional(),
  after: z.string().nullable().optional()
});

const adsSchema = adsBase.superRefine((v, ctx) => {
  if (v.mode === 'page' && !v.page_id) {
    ctx.addIssue({ code: 'custom', path: ['page_id'], message: 'mode "page" richiede page_id' });
  }
  if (v.mode === 'page' && v.search_terms) {
    ctx.addIssue({ code: 'custom', path: ['search_terms'], message: 'mode "page" does not take search_terms' });
  }
  if (v.mode === 'search' && !v.search_terms) {
    ctx.addIssue({ code: 'custom', path: ['search_terms'], message: 'mode "search" richiede search_terms' });
  }
  if (v.mode === 'search' && v.page_id) {
    ctx.addIssue({ code: 'custom', path: ['page_id'], message: 'mode "search" does not take page_id' });
  }
});

/**
 * `influencer`: nasce già pieno, come `products` — la riga in `influencers` esiste prima che il
 * nodo la referenzi, `influencer_id` è l'unico campo che il CHECK impone. `data` non porta le
 * viste (sarebbero decine di URL che viaggiano a ogni evento realtime, lo stesso motivo per cui
 * `products` non porta il catalogo): il server le legge da `influencer_views` e le passa come
 * prop a `InfluencerNode.svelte`, la stessa dottrina di `ProductsNode.svelte`.
 */
const influencerSchema = z.object({
  influencer_id: z.string()
});

/**
 * `list`: N valori, un `item_kind` solo — immagini o testo, mai mischiati, perché un'iterazione
 * (`loop-plan.ts`) pesca un valore alla volta dallo stesso connettore per tutta la lista. Un
 * `item` porta o `asset_id` (trascinato da un altro nodo/dalla libreria) o `text` (scritto o
 * incollato a mano); mai entrambi vuoti — un item senza contenuto non è un'iterazione, è un buco.
 */
const LIST_ITEM_KINDS = ['image', 'text'] as const;

const listItemSchema = z
  .object({
    label: z.string().optional(),
    asset_id: z.string().optional(),
    text: z.string().optional(),
    url: z.string().optional()
  })
  .refine((v) => Boolean(v.asset_id) || Boolean(v.text) || Boolean(v.url), {
    message: 'every item needs an asset_id, a text or a url'
  });

const listSchema = z.object({
  item_kind: z.enum(LIST_ITEM_KINDS),
  items: z.array(listItemSchema)
});

/**
 * `select`: sceglie UN item da una lista a monte, per indice. `index` È 1-BASED — la stessa cifra
 * che compare nel nodo e nel thumbnail cliccato, senza una traduzione da tenere sincronizzata fra
 * UI e storage. Fuori range o lista vuota non è un errore di schema (dipende da un'altra riga, che
 * questo file non vede): lo dice `resolveUpstreamInputs`, con `rejected`/`blocked` come ogni altro
 * ingresso mancante.
 */
const OUTPUT_FIELDS_DESCRIPTION = `Field of the connected source item; the edge from this node carries source_handle "out:field:<field>" (defaults: "out:images", "out:text"). ${Object.entries(
  SOURCE_ITEM_FIELDS
)
  .map(([source, fields]) => `${source}: ${fields.map((f) => `${f.key} (${f.port})`).join(', ')}`)
  .join('. ')}`;

const selectOutputSchema = z
  .object({
    id: z.string().min(1),
    field: z.string().min(1).describe(OUTPUT_FIELDS_DESCRIPTION),
    label: z.string().max(MAX_OUTPUT_LABEL).optional()
  })
  .strict();

const selectSchema = z.object({
  index: z.number().int().positive(),
  outputs: z.array(selectOutputSchema).max(MAX_CUSTOM_OUTPUTS).optional()
});

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * UNO SCHEMA PARAMETRI PER EFFETTO, GENERATO DALLA TABELLA `EFFECTS` — mai una seconda lista
 * scritta a mano che diverge al primo parametro aggiunto. `range` diventa un numero fra `min` e
 * `max`, `select` una delle `options.value`, `color` un hex `#rrggbb`, `seed` un intero. Un
 * parametro assente prende il `default` della tabella (`.default(...)`), uno che non compare fra
 * i `params` dell'effetto è rifiutato da `.strict()`.
 */
function paramFieldSchema(param: EffectParam) {
  if (param.kind === 'range') {
    return z.number().min(param.min).max(param.max).default(param.default);
  }
  if (param.kind === 'select') {
    const values = param.options.map((option) => option.value) as [string, ...string[]];
    return z.enum(values).default(param.default);
  }
  if (param.kind === 'color') {
    return z.string().regex(HEX_COLOR, 'invalid colour, expected #rrggbb').default(param.default);
  }
  return z.int().default(param.default);
}

function paramsSchemaFor(id: EffectId) {
  const shape = Object.fromEntries(EFFECTS[id].params.map((param) => [param.name, paramFieldSchema(param)]));
  return z.object(shape).strict();
}

/**
 * `effects`: una PILA di effetti sopra un'immagine a monte (`sourceRefId`), il risultato applicato
 * in `refId` — lo stesso schema `refId`/`sourceRefId` di un nodo che genera, ma senza `genState`:
 * non c'è un provider da aspettare, `applyStack` (`effects/index.ts`) gira nel browser. Ogni `id`
 * di `EffectStep` deve esistere nella tabella `EFFECTS`: un id sconosciuto (un effetto tolto dal
 * catalogo, un refuso scritto a mano) rifiuta il nodo invece di applicare silenziosamente niente.
 * `params` si valida CONTRO L'EFFETTO SCELTO (`superRefine`, non un secondo `z.union` che accetta
 * qualunque numero o stringa): lo stesso schema che rifiuta un range fuori limite rifiuta anche un
 * parametro che quell'effetto non ha.
 */
const effectStepSchema = z
  .object({
    id: z.string().refine((id): id is EffectId => id in EFFECTS, { message: 'effetto sconosciuto' }),
    params: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
    enabled: z.boolean().default(true)
  })
  .superRefine((step, ctx) => {
    if (!(step.id in EFFECTS)) return;

    const result = paramsSchemaFor(step.id as EffectId).safeParse(step.params);
    if (result.success) {
      step.params = result.data;
      return;
    }
    for (const issue of result.error.issues) {
      const field = issue.path.length ? issue.path.join('.') : '(parametro)';
      ctx.addIssue({
        code: 'custom',
        path: ['params'],
        message: `${step.id}.${field}: ${issue.message}`
      });
    }
  });

const effectsSchema = z.object({
  effects: z.array(effectStepSchema).default([]),
  refId: z.string().nullish(),
  sourceRefId: z.string().nullish()
});

const calendarSchema = z.object({
  view: z.enum(CALENDAR_VIEWS),
  scope: z.enum(CALENDAR_SCOPES),
  brand_id: z.string().nullable().optional(),
  anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const LAYOUT_IDS = Object.keys(LAYOUTS) as [LayoutId, ...LayoutId[]];
const CAMERA_PRESET_IDS = Object.keys(CAMERA_PRESETS) as [CameraPresetId, ...CameraPresetId[]];
const COMPOSITION_ASPECTS = ['9:16', '1:1', '16:9'] as const;

const compositionCameraSchema = z.object({
  preset: z.enum(CAMERA_PRESET_IDS),
  params: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  keyframes: z
    .array(
      z.object({
        t: z.number(),
        camera: z.object({
          position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
          target: z.object({ x: z.number(), y: z.number(), z: z.number() }),
          fov: z.number()
        }),
        easing: z.enum(['linear', 'ease-in-out'])
      })
    )
    .optional()
});

const compositionSchema = z.object({
  layout: z.enum(LAYOUT_IDS),
  layoutParams: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  camera: compositionCameraSchema,
  background: z.object({ color: z.string().regex(HEX_COLOR, 'invalid colour, expected #rrggbb') }),
  duration: z.number().positive(),
  aspect: z.enum(COMPOSITION_ASPECTS),
  refId: z.string().nullish()
});

/**
 * LA TABELLA — un tipo nuovo è una riga qui, non un `if` in `write-tool.ts`. `nodes_type_check`
 * (vedi `org-data/checks.ts`) deve restare la stessa lista, e `node-data.test.ts` lo verifica.
 */
export const NODE_DATA_SCHEMAS = {
  text: textSchema,
  image: imageSchema,
  video: videoSchema,
  doc: docSchema,
  iframe: iframeSchema,
  social_account_feed: socialAccountFeedSchema,
  social_post_mockup: socialPostMockupSchema,
  products: productsSchema,
  ads: adsSchema,
  influencer: influencerSchema,
  list: listSchema,
  select: selectSchema,
  effects: effectsSchema,
  composition: compositionSchema,
  calendar: calendarSchema,
  audio: audioSchema
} as const;

export type NodeType = keyof typeof NODE_DATA_SCHEMAS;

export const NODE_TYPES = Object.keys(NODE_DATA_SCHEMAS) as NodeType[];

export function isNodeType(x: string): x is NodeType {
  return (NODE_TYPES as readonly string[]).includes(x);
}

export type NodeDataVerdict = { ok: true; data: Record<string, unknown> } | { ok: false; error: string };

/**
 * LA STESSA TABELLA, VERSO L'ESTERNO — un agente che chiama `insert_row('nodes', …)` non deve
 * indovinare la forma di `data`: qui la chiede per tipo, o per tutti e dieci insieme.
 *
 * `z.toJSONSchema` deriva lo schema DA `NODE_DATA_SCHEMAS`, mai una copia scritta a mano: le due
 * cose sono la stessa riga letta due volte, e non possono divergere al prossimo campo aggiunto.
 * Il `$schema` che l'SDK ripete su ogni tool costava 10.948 caratteri altrove (vedi
 * `tool-surface-cost.test.ts`) — qui si toglie per lo stesso motivo, un client non lo legge.
 */
export function describeNodeType(type: NodeType): Record<string, unknown> {
  const { $schema: _drop, ...schema } = z.toJSONSchema(NODE_DATA_SCHEMAS[type]) as Record<string, unknown>;
  return schema;
}

export function describeNodeTypes(): Record<NodeType, Record<string, unknown>> {
  return Object.fromEntries(NODE_TYPES.map((type) => [type, describeNodeType(type)])) as Record<
    NodeType,
    Record<string, unknown>
  >;
}

/**
 * LA FORMA CHE VA NEL DATABASE — required + enum del discriminante, e nient'altro.
 *
 * `describeNodeType` è per l'agente: gli serve ogni vincolo (`minLength`, `format: uri`, i
 * campi opzionali) per non indovinare. Un CHECK con `pg_jsonschema` è un'altra cosa — è
 * l'ULTIMA riga di difesa, quella che nessuno scavalca nemmeno con la service-role key, e per
 * questo deve restare permissiva: stringere un vincolo lì dentro vuol dire rivalidare ogni riga
 * esistente, mentre stringere `NODE_DATA_SCHEMAS` è solo codice che cambia. Qui si tiene SOLO
 * ciò che non cambierà mai senza una migrazione dei dati — quali campi esistono e, quando è un
 * enum, quali valori — mai un `minLength`, un `format`, un tetto numerico.
 *
 * DERIVATA DALLA STESSA `NODE_DATA_SCHEMAS`, non riscritta a mano: la migrazione che usa questa
 * funzione incolla il suo output com'è (vedi lo script che la genera), così le due verità — lo
 * schema che risponde all'agente e il CHECK che il database impone — restano la stessa riga
 * letta due volte, non due file che un domani divergono in silenzio.
 */
export function looseNodeJsonSchema(type: NodeType): Record<string, unknown> {
  const full = z.toJSONSchema(NODE_DATA_SCHEMAS[type]) as {
    type?: string;
    required?: string[];
    properties?: Record<string, { type?: string; enum?: unknown[] }>;
  };

  const required = full.required ?? [];
  const properties: Record<string, unknown> = {};
  for (const key of required) {
    const prop = full.properties?.[key];
    if (!prop) continue;
    properties[key] = prop.enum ? { type: prop.type, enum: prop.enum } : { type: prop.type };
  }

  return { type: 'object', required, properties };
}

/**
 * UN URL FIRMATO NON ENTRA MAI IN `nodes.data` — scade (due ore su Supabase Storage), e `data` è
 * ciò che sopravvive a una ricarica. La forma giusta è un riferimento stabile (`refId`/`assetId`)
 * rifirmato a ogni lettura (`signAssetPaths`); un URL firmato scritto qui è un riquadro rotto in
 * attesa di succedere. Il pattern è quello di Supabase Storage: `/storage/v1/object/sign/...`.
 */
const SIGNED_STORAGE_URL = /\/storage\/v1\/object\/sign\//;

function findSignedUrl(data: unknown): string | null {
  if (typeof data === 'string') {
    return SIGNED_STORAGE_URL.test(data) ? data : null;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findSignedUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (data && typeof data === 'object') {
    for (const value of Object.values(data)) {
      const found = findSignedUrl(value);
      if (found) return found;
    }
  }
  return null;
}

export function validateNodeData(type: string, data: unknown): NodeDataVerdict {
  if (!isNodeType(type)) {
    return { ok: false, error: `type sconosciuto: "${type}". Sono ${NODE_TYPES.join(', ')}.` };
  }

  const signedUrl = findSignedUrl(data);
  if (signedUrl) {
    return { ok: false, error: `data contiene un url firmato, che scade: "${signedUrl}"` };
  }

  const schema = NODE_DATA_SCHEMAS[type];
  const result = schema.safeParse(data ?? {});
  if (result.success) {
    return { ok: true, data: result.data as Record<string, unknown> };
  }

  const [issue] = result.error.issues;
  const field = issue.path.length ? issue.path.join('.') : '(radice)';
  return { ok: false, error: `${type}.data.${field}: ${issue.message}` };
}

/**
 * Un `update_row` legittimo tocca UN campo (`data.status`, un nuovo `prompt`) senza rimandare gli
 * altri. Si valida il RISULTATO — la riga esistente con la patch sopra — non la patch da sola: una
 * patch che manda `status: 'done'` senza `prompt` non è mai valida da sola su `text`, ma lo È
 * quando si fonde con la riga che il prompt ce l'ha già. Validare la patch isolata rifiuterebbe
 * ogni update parziale legittimo.
 */
export function validateNodeDataPatch(type: string, current: unknown, patch: unknown): NodeDataVerdict {
  return validateNodeData(type, mergeNodeData((current ?? {}) as NodeData, (patch ?? {}) as NodeData));
}

const MISPLACED_FIELD_HINTS: Partial<Record<string, string>> = {
  content: 'Written text for the user to read goes in a doc node: type "doc", data { content: "<markdown>", public: false }.'
};

function fieldsOf(type: NodeType): string[] {
  return Object.keys((describeNodeType(type).properties ?? {}) as Record<string, unknown>);
}

export const SYSTEM_OWNED_FIELDS = [
  'refId',
  'sourceRefId',
  'mediaKind',
  'assetId',
  'runId',
  'running',
  'error',
  'params',
  'html',
  'outputUncensored'
] as const;

export enum FieldScope {
  Schema = 'schema',
  WithSystem = 'with-system'
}

const FIELDS_BY_SCOPE: Record<FieldScope, (type: NodeType) => string[]> = {
  [FieldScope.Schema]: fieldsOf,
  [FieldScope.WithSystem]: (type) => [...new Set([...fieldsOf(type), ...SYSTEM_OWNED_FIELDS])]
};

export function unknownFieldsError(type: string, data: unknown, scope = FieldScope.Schema): string | null {
  if (!isNodeType(type) || !data || typeof data !== 'object') {
    return null;
  }

  const allowed = FIELDS_BY_SCOPE[scope](type);
  const unknown = Object.entries(data)
    .filter(([key, value]) => value !== null && !allowed.includes(key))
    .map(([key]) => key);
  if (!unknown.length) {
    return null;
  }

  const hints = unknown.flatMap((key) => MISPLACED_FIELD_HINTS[key] ?? []);
  return [
    `${type}.data has no field ${unknown.map((key) => `"${key}"`).join(', ')}. Allowed: ${allowed.join(', ')}.`,
    ...hints
  ].join(' ');
}

export function validateNewNodeData(type: string, data: unknown): NodeDataVerdict {
  const unknown = unknownFieldsError(type, data);
  if (unknown) {
    return { ok: false, error: unknown };
  }
  return validateNodeData(type, data);
}

export function validateNodeDataUpdate(type: string, current: unknown, patch: unknown): NodeDataVerdict {
  const unknown = unknownFieldsError(type, patch, FieldScope.WithSystem);
  if (unknown) {
    return { ok: false, error: unknown };
  }
  return validateNodeDataPatch(type, current, patch);
}
