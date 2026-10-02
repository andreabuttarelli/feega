import type { SupabaseClient } from '@supabase/supabase-js';
import { IMAGE_MODEL_CHOICES, imageModelSpec, IMAGE_REFS_BUDGET, type ImageModelSpec } from '$lib/image-models';
import { videoModelSpec, type VideoModelSpec } from '$lib/video-models';
import type { ModelChoice } from '$lib/canvas/gen-node';
import type { MediaModelSlot } from '$lib/media-model-slots';
import { wireModelId, type ImagePricingLine } from '$lib/server/ai-models-sync';
import { providerOf } from '$lib/canvas/model-provider';
import { videoCredits } from '$lib/server/content-cost';
import { billedCreditsFor } from '$lib/credit-ladder';
import { videoDurationOptions, VIDEO_RESOLUTIONS, MIN_DURATION } from '$lib/server/video';
import { modelParamsOf } from '$lib/canvas/model-params';
import { WIRO_PROVIDER } from './wiro-catalogue';
import { wiroChoice } from './wiro-choice';
import { REVIEWED_MODEL3D_MODELS } from '$lib/model3d-models';

const VIDEO_SPEC_IDS = [
  'bytedance/seedance-2-5',
  'bytedance/seedance-2',
  'bytedance/seedance-2-fast',
  'bytedance/seedance-2-mini',
  'grok-imagine-video-1-5-preview',
  'grok-imagine/image-to-video',
  'kling-3.0/video',
  'black-forest-labs/flux-video-upscale'
];

type SyncedCatalogue = 'image' | 'video' | 'model3d';

type SyncedRow = {
  id: string;
  label: string | null;
  input_modalities: string[] | null;
  supported_parameters: string[] | null;
  supported_resolutions: string[] | null;
  param_schema: Record<string, unknown> | null;
  pricing: unknown;
  provider?: string | null;
  uncensored?: boolean | null;
  wire_spec?: unknown;
};

async function syncedRows(
  admin: SupabaseClient,
  catalogue: SyncedCatalogue
): Promise<{ rows: Map<string, SyncedRow>; synced: boolean }> {
  const { data } = await admin
    .from('ai_models')
    .select('id, label, input_modalities, supported_parameters, supported_resolutions, param_schema, pricing, provider, uncensored, wire_spec')
    .eq('catalogue', catalogue);

  const rows = (data ?? []) as SyncedRow[];
  return {
    rows: new Map(rows.map((r) => [r.id, r])),
    synced: rows.length > 0
  };
}

/**
 * LA RESA PIÙ PRUDENTE, per un modello sincronizzato che non ha uno spec nostro a dirci cosa
 * accetta davvero. `1:1` è nell'elenco di OGNI famiglia integrata qui (Nano Banana, Seedream, GPT
 * Image, Qwen — vedi `image-models.ts`): non un valore inventato, il minimo comune che ogni
 * provider immagine visto finora pubblica.
 */
const GENERIC_IMAGE_ASPECTS = ['1:1'];

/**
 * LE RISOLUZIONI CHE QUESTO MODELLO ACCETTA DAVVERO — dalla riga sincronizzata
 * (`ai_models.supported_resolutions`, `/images/models` → `supported_parameters.resolution.values`),
 * mai un gradino condiviso: misurato il 2026-09-25, Seedream 5 Lite dichiara `[2K,4K]` (mai 1K),
 * Seedream 5 Pro `[1K,2K]` (mai 4K), Nano Banana 2 `[512,1K,2K,4K]`. Un modello senza `resolution`
 * fra i suoi parametri (i GPT Image, che usano `quality`) torna vuoto: assente = una sola resa, e
 * la barra non mostra il selettore.
 */
function imageResolutionsFor(supportedResolutions: string[] | null): string[] | undefined {
  return supportedResolutions?.length ? supportedResolutions : undefined;
}

function genericImageChoice(row: SyncedRow): ModelChoice {
  return {
    id: row.id,
    label: row.label ?? row.id,
    aspectRatios: GENERIC_IMAGE_ASPECTS,
    maxRefs: IMAGE_REFS_BUDGET,
    ...providerOf(row.id),
    wireId: row.id,
    inputModalities: row.input_modalities ?? [],
    resolutions: imageResolutionsFor(row.supported_resolutions),
    unitCredits: imageUnitCredits(row.pricing),
    creditOverrides: imageCreditOverrides(row),
    variableCredits: hasVariableCredits(row.pricing),
    params: modelParamsOf(row.param_schema ?? {})
  };
}

/**
 * LE RISOLUZIONI CHE QUESTO MODELLO ACCETTA DAVVERO — dalla riga sincronizzata
 * (`ai_models.supported_resolutions`, `/videos/models`), mai un elenco condiviso: `happyhorse-1.0`
 * dichiara `["720p", "1080p"]`, mai 480p, e offrirgli 480p è il rifiuto che ha aperto questo file
 * (`video_renders` cb1de6e2). Vuoto (sync non ancora arrivato a quel campo, o riga anteriore alla
 * migration) ripiega su `VIDEO_RESOLUTIONS`, il tetto misurato del nostro trasporto — mai un menu
 * senza selettore, che spedirebbe la resa di default silenziosa.
 */
const CHOICE_OF_PROVIDER: Readonly<Record<string, (row: SyncedRow) => ModelChoice>> = {
  [WIRO_PROVIDER]: wiroChoice
};

function unspeccedChoice(row: SyncedRow, generic: (row: SyncedRow) => ModelChoice): ModelChoice {
  return (CHOICE_OF_PROVIDER[row.provider ?? ''] ?? generic)(row);
}

function videoResolutionsFor(row: SyncedRow): string[] {
  return row.supported_resolutions?.length ? row.supported_resolutions : [...VIDEO_RESOLUTIONS];
}

/**
 * Idem per il video: un solo rapporto (verticale, il formato di ogni social feed che questo
 * prodotto pubblica) e una sola durata — `MIN_DURATION` del prodotto, non il minimo grezzo del
 * provider, che non conosciamo per un modello senza spec.
 */
function genericVideoChoice(row: SyncedRow): ModelChoice {
  return {
    id: row.id,
    label: row.label ?? row.id,
    aspectRatios: ['9:16'],
    minDuration: MIN_DURATION,
    maxDuration: MIN_DURATION,
    durationOptions: [MIN_DURATION],
    resolutions: videoResolutionsFor(row),
    ...providerOf(row.id),
    wireId: row.id,
    inputModalities: row.input_modalities ?? [],
    unitCredits: undefined,
    params: modelParamsOf(row.param_schema ?? {})
  };
}

function imageChoice(
  spec: ImageModelSpec,
  wireId: string,
  row: SyncedRow
): ModelChoice {
  return {
    id: spec.id,
    label: spec.label,
    aspectRatios: spec.aspectRatios,
    maxRefs: spec.maxRefs,
    ...providerOf(wireId),
    wireId,
    inputModalities: row.input_modalities ?? [],
    resolutions: imageResolutionsFor(row.supported_resolutions),
    unitCredits: imageUnitCredits(row.pricing),
    creditOverrides: imageCreditOverrides(row),
    variableCredits: hasVariableCredits(row.pricing),
    params: modelParamsOf(row.param_schema ?? {})
  };
}

function imageUnitCredits(pricing: unknown): number | undefined {
  if (hasVariableCredits(pricing)) {
    return undefined;
  }
  const costs = pricingLines(pricing)
    .filter((line) => line.billable === 'output_image' && line.unit === 'image' && !line.variant)
    .map((line) => line.cost_usd);
  return costs.length ? billedCreditsFor(Math.min(...costs)) : undefined;
}

function imageCreditOverrides(row: SyncedRow): Record<string, Record<string, number>> | undefined {
  const overrides: Record<string, Record<string, number>> = {};
  for (const resolution of row.supported_resolutions ?? []) {
    const cost = cheapestEndpointCost(row.pricing, 'resolution', resolution, row.supported_resolutions ?? []);
    if (cost !== undefined) {
      overrides.resolution = { ...(overrides.resolution ?? {}), [resolution]: billedCreditsFor(cost) };
    }
  }

  const quality = row.param_schema?.quality as { values?: unknown } | undefined;
  if (Array.isArray(quality?.values)) {
    for (const value of quality.values.map(String)) {
      const cost = cheapestEndpointCost(row.pricing, 'quality', value, []);
      if (cost !== undefined) {
        overrides.quality = { ...(overrides.quality ?? {}), [value]: billedCreditsFor(cost) };
      }
    }
  }

  return Object.keys(overrides).length ? overrides : undefined;
}

type PricingEndpoint = {
  lines: ImagePricingLine[];
  parameters: Record<string, unknown>;
};

function cheapestEndpointCost(
  pricing: unknown,
  parameter: 'resolution' | 'quality',
  value: string,
  resolutions: string[]
): number | undefined {
  const costs = pricingEndpoints(pricing).flatMap((endpoint) => {
    const variants = endpoint.lines.filter(
      (line) =>
        line.billable === 'output_image' &&
        line.unit === 'image' &&
        line.variant &&
        (parameter === 'resolution'
          ? resolutionForVariant(line.variant, resolutions) === value
          : line.variant === value)
    );
    if (variants.length) {
      return variants.map((line) => line.cost_usd);
    }
    if (!endpointSupports(endpoint, parameter, value)) {
      return [];
    }
    return endpoint.lines
      .filter((line) => line.billable === 'output_image' && line.unit === 'image' && !line.variant)
      .map((line) => line.cost_usd);
  });
  return costs.length ? Math.min(...costs) : undefined;
}

function endpointSupports(endpoint: PricingEndpoint, parameter: string, value: string): boolean {
  const declaration = endpoint.parameters[parameter];
  if (!declaration || typeof declaration !== 'object') {
    return false;
  }
  const values = (declaration as { values?: unknown }).values;
  return Array.isArray(values) && values.some((candidate) => String(candidate).toLowerCase() === value.toLowerCase());
}

function pricingLines(pricing: unknown): ImagePricingLine[] {
  return pricingEndpoints(pricing).flatMap((endpoint) => endpoint.lines);
}

function pricingEndpoints(pricing: unknown): PricingEndpoint[] {
  if (!pricing || typeof pricing !== 'object') {
    return [];
  }
  const endpoints = (pricing as Record<string, unknown>).endpoints;
  if (!Array.isArray(endpoints)) {
    return [];
  }
  return endpoints.flatMap((endpoint) => {
    if (!endpoint || typeof endpoint !== 'object') {
      return [];
    }
    const lines = (endpoint as Record<string, unknown>).lines;
    const parameters = (endpoint as Record<string, unknown>).parameters;
    return [{
      lines: Array.isArray(lines) ? lines.filter(isImagePricingLine) : [],
      parameters: parameters && typeof parameters === 'object' && !Array.isArray(parameters)
        ? parameters as Record<string, unknown>
        : {}
    }];
  });
}

function isImagePricingLine(value: unknown): value is ImagePricingLine {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const line = value as Record<string, unknown>;
  return (
    typeof line.billable === 'string' &&
    typeof line.unit === 'string' &&
    typeof line.cost_usd === 'number' &&
    Number.isFinite(line.cost_usd) &&
    (line.variant === undefined || typeof line.variant === 'string')
  );
}

function hasVariableCredits(pricing: unknown): boolean {
  return pricingLines(pricing).some(
    (line) =>
      (line.billable === 'output_image' && (line.unit === 'token' || line.unit === 'megapixel')) ||
      ((line.billable === 'input_image' || line.billable === 'input_reference') && line.cost_usd > 0)
  );
}

function resolutionForVariant(variant: string, resolutions: string[]): string | undefined {
  const exact = resolutions.find((resolution) => resolution.toLowerCase() === variant.toLowerCase());
  if (exact) {
    return exact;
  }
  return RESOLUTION_VARIANTS[variant]?.(resolutions);
}

function resolutionPixels(resolution: string): number {
  const value = Number.parseFloat(resolution);
  return resolution.toLowerCase().endsWith('k') ? value * 1000 : value;
}

const RESOLUTION_VARIANTS: Record<string, (resolutions: string[]) => string | undefined> = {
  high_resolution: (resolutions) =>
    [...resolutions].sort((left, right) => resolutionPixels(left) - resolutionPixels(right)).at(-1)
};

function videoChoice(spec: VideoModelSpec, row: SyncedRow, inputModalities: string[]): ModelChoice {
  return {
    id: spec.id,
    label: spec.label,
    aspectRatios: [...spec.ratios],
    minDuration: spec.minDuration,
    maxDuration: spec.maxDuration,
    durationOptions: videoDurationOptions(spec.id),
    maxPromptChars: spec.maxPromptChars,
    generateAudio: spec.generateAudio,
    // Dalla riga sincronizzata: ogni modello dichiara le SUE risoluzioni su `/videos/models`, mai
    // un tetto uguale per tutti — v. `videoResolutionsFor`.
    resolutions: videoResolutionsFor(row),
    ...providerOf(row.id),
    wireId: row.id,
    inputModalities,
    unitCredits: videoCredits(spec.id),
    params: modelParamsOf(row.param_schema ?? {})
  };
}

async function offerableImages(admin: SupabaseClient): Promise<OfferableModels> {
  const { rows, synced } = await syncedRows(admin, 'image');

  const specs = IMAGE_MODEL_CHOICES.map((c) => imageModelSpec(c.id)).filter(
    (spec): spec is ImageModelSpec => !!spec
  );
  const wireIds = await Promise.all(specs.map((spec) => wireModelId(spec.id, 'image')));
  const specced = new Set<string>();
  const choices: ModelChoice[] = [];
  specs.forEach((spec, i) => {
    const wireId = wireIds[i];
    const row = wireId ? rows.get(wireId) : undefined;
    if (!wireId || !row) {
      return;
    }
    specced.add(wireId);
    choices.push(imageChoice(spec, wireId, row));
  });

  // OGNI riga sincronizzata che nessuno spec ha già arricchito: offerta con la resa prudente,
  // non nascosta. Questo è il cambio che fa passare il menu da "le famiglie che abbiamo scritto a
  // mano" a "quello che OpenRouter pubblica davvero" (CLAUDE.md — l'app segue il catalogo).
  for (const [id, row] of rows) {
    if (!specced.has(id)) choices.push(unspeccedChoice(row, genericImageChoice));
  }

  return { synced, choices };
}

async function offerableVideos(admin: SupabaseClient): Promise<OfferableModels> {
  const { rows, synced } = await syncedRows(admin, 'video');

  const specs = VIDEO_SPEC_IDS.map((id) => videoModelSpec(id)).filter(
    (spec): spec is VideoModelSpec => !!spec
  );
  const wireIds = await Promise.all(specs.map((spec) => wireModelId(spec.id, 'video')));
  const specced = new Set<string>();
  const choices: ModelChoice[] = [];
  specs.forEach((spec, i) => {
    const wireId = wireIds[i];
    const row = wireId ? rows.get(wireId) : undefined;
    if (!wireId || !row) return;
    specced.add(wireId);
    choices.push(videoChoice(spec, row, row.input_modalities ?? []));
  });

  for (const [id, row] of rows) {
    if (!specced.has(id)) choices.push(unspeccedChoice(row, genericVideoChoice));
  }

  return { synced, choices };
}

export type OfferableModels = { synced: boolean; choices: ModelChoice[] };

/**
 * QUEL CHE QUESTO MEDIUM PUÒ OFFRIRE, ORA. Il testo non passa da questa regola: il centralino
 * (`openrouter-models.ts`) legge già il listino chat intero per il picker della chat, e un modello
 * che parla non ha un secondo spec di integrazione da incrociare — `text` è dominio di
 * `canvas-catalogue.ts`, non di questo file, che serve immagine e video: i due medium dove un
 * nostro spec (`imageField`/`videoField`, `maxRefs`, prezzo) decide se il render riesce o no.
 */
async function offerableModels3d(admin: SupabaseClient): Promise<OfferableModels> {
  const { rows, synced } = await syncedRows(admin, 'model3d');
  const reviewed = [...rows.values()].filter((row) => REVIEWED_MODEL3D_MODELS.has(row.id));
  return { synced, choices: reviewed.map(wiroChoice) };
}

const OFFERABLE: Readonly<Record<SyncedCatalogue, (admin: SupabaseClient) => Promise<OfferableModels>>> = {
  image: offerableImages,
  video: offerableVideos,
  model3d: offerableModels3d
};

export async function offerableModels(admin: SupabaseClient, medium: SyncedCatalogue): Promise<OfferableModels> {
  return OFFERABLE[medium](admin);
}

/**
 * LO STESSO CANCELLO, PER I SEI MESTIERI DELLE SETTINGS (`media-model-slots.ts`). Uno slot video
 * non offre "tutto il video sincronizzato": offre il sottoinsieme che sa fare QUEL ruolo — Kling
 * anima e riscrive, Seedance 2.5 no — la stessa distinzione che `slotAccepts` applica alla
 * scrittura, applicata qui alla lettura, perché un menù che offre un modello che il salvataggio
 * poi rifiuta è la stessa quiete rotta che `slotAccepts` esiste per evitare.
 */
export async function offerableSlotChoices(admin: SupabaseClient, slot: MediaModelSlot): Promise<OfferableModels> {
  if (!slot.role) return offerableImages(admin);

  const all = await offerableVideos(admin);
  const choices = all.choices.filter((c) => videoModelSpec(c.id)?.roles.includes(slot.role!));
  return { synced: all.synced, choices };
}
