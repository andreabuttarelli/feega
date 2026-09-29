/**
 * I MODELLI CHE UN NODO DELLA TELA PUÒ SCEGLIERE.
 *
 * Due fonti, e non è disordine: sono due cose diverse.
 *
 *   IL TESTO viene dal centralino (`openrouter-models`), l'INTERO listino chat del gateway: un
 *   nodo che scrive testo non ha bisogno di saper chiamare tool o leggere immagini, e un modello
 *   nuovo pubblicato dal gateway compare da sé senza che nessuno tocchi questo repo. Le SUE porte
 *   (`connectors.ts`) restano guidate da `ai_models` come immagine e video: `chatInputModalities`
 *   legge il listino `chat` sincronizzato — un modello non ancora sincronizzato lì non inventa
 *   porte oltre a quella fissa, torna `inputModalities: []`.
 *
 *   IMMAGINE E VIDEO vengono da `offerableModels` (`$lib/server/offerable-models`): un modello è
 *   offerto solo quando ha SIA una riga sincronizzata in `ai_models` (cosa accetta, da OpenRouter)
 *   SIA un nostro spec di integrazione (come lo si chiama — `image-models.ts`/`video-models.ts`).
 *   Quei limiti viaggiano CON la scelta: senza, chi vuole venti secondi in 9:16 lo scopre dal
 * rifiuto, dopo aver pagato il giro.
 *
 * `synced` DICE PERCHÉ IL MENU DI UN MEDIUM È VUOTO: `ai_models` senza righe per quel listino —
 * primo avvio, DB di branch, sync mai girato — produce zero scelte, e senza questo flag un
 * dropdown vuoto sembra un difetto invece che la conseguenza accettata della regola "non
 * sincronizzato, non offerto". Il testo non ha un equivalente: il centralino tiene sempre almeno
 * la sua cache o torna vuoto senza che la regola del prodotto sia in gioco.
 */
import { gatewayModels, ensureGatewayModels } from './openrouter-models';
import { offerableModels } from './offerable-models';
import { chatInputModalities } from './ai-models-sync';
import type { GenMedium, ModelChoice } from '$lib/canvas/gen-node';
import { providerOf } from '$lib/canvas/model-provider';
import { createAdminClient } from './supabase-admin';
import { TEXT_NODE_CREDITS } from '$lib/server/content-cost';
import { CREDITS_PER_USD_SUBSCRIPTION_LIST } from '$lib/credit-ladder';
import { withRecommendations, type CandidateModel, type Recommendation } from '$lib/canvas/recommended-models';
import { syncedCandidates } from './recommended-models';
import { AUDIO_INPUT_MODALITIES, AUDIO_OPERATION_IDS, AUDIO_PROVIDER, audioModelsOf, operationSpec } from '$lib/canvas/audio-operations';

function audioChoices(): ModelChoice[] {
  return AUDIO_OPERATION_IDS.flatMap((operation) =>
    audioModelsOf(operation).map((id) => ({
      id,
      label: `${operationSpec(operation).label} · ${id}`,
      aspectRatios: [],
      ...AUDIO_PROVIDER,
      wireId: id,
      inputModalities: AUDIO_INPUT_MODALITIES,
      variableCredits: true
    }))
  );
}

export type MediumCatalogue = {
  choices: ModelChoice[];
  synced: boolean;
  /** Il prezzo di UNA riscrittura "Migliora prompt" (`prompt-enhance.ts`), dallo stesso listino
   *  di `TEXT_NODE_CREDITS` — la riscrittura è un giro del modello di craft, lo stesso mestiere
   *  di un nodo testo. Assente su `text`: il testo non ha craft di prompting da riscrivere. */
  enhanceUnitCredits?: number;
  recommended: Recommendation[];
  candidates: CandidateModel[];
};

/**
 * Il catalogo completo, un medium alla volta.
 *
 * `ensureGatewayModels` non è atteso a vuoto: il centralino tiene una cache di processo, e senza
 * questa chiamata il primo caricamento della tela troverebbe la lista vuota — cioè un menù che si
 * riempie solo alla seconda visita, che è il difetto peggiore da diagnosticare.
 */
export async function canvasModelCatalogue(): Promise<Record<GenMedium, MediumCatalogue>> {
  await ensureGatewayModels().catch(() => {});
  const admin = createAdminClient();

  const [image, video, textModalities, textSynced, imageSynced, videoSynced] = await Promise.all([
    offerableModels(admin, 'image'),
    offerableModels(admin, 'video'),
    chatInputModalities(admin),
    syncedCandidates(admin, 'text'),
    syncedCandidates(admin, 'image'),
    syncedCandidates(admin, 'video')
  ]);
  const now = new Date();

  const textChoices: ModelChoice[] = gatewayModels().map((m) => ({
    id: m.id,
    label: m.label,
    aspectRatios: [],
    ...providerOf(m.id),
    wireId: m.id,
    inputModalities: textModalities.get(m.id) ?? [],
    textPricing: {
      inputCreditsPerMillion: m.rate.input * CREDITS_PER_USD_SUBSCRIPTION_LIST,
      outputCreditsPerMillion: m.rate.output * CREDITS_PER_USD_SUBSCRIPTION_LIST,
      systemPromptTokens: 0
    }
  }));

  return {
    text: { ...withRecommendations('text', textChoices, textSynced, now), synced: true },
    image: { ...image, ...withRecommendations('image', image.choices, imageSynced, now), enhanceUnitCredits: TEXT_NODE_CREDITS },
    video: { ...video, ...withRecommendations('video', video.choices, videoSynced, now), enhanceUnitCredits: TEXT_NODE_CREDITS },
    audio: { choices: audioChoices(), synced: true, recommended: [], candidates: [] }
  };
}
