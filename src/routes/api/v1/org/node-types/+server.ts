import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { describeNodeType, describeNodeTypes, isNodeType } from '$lib/canvas/node-data';
import { canvasModelCatalogue } from '$lib/server/canvas-catalogue';
import { GEN_MEDIUMS } from '$lib/canvas/gen-node';
import { AUDIO_OPERATION_IDS, DUBBING_LANGUAGES, audioModelsOf, operationSpec } from '$lib/canvas/audio-operations';

function audioOperations() {
  return Object.fromEntries(
    AUDIO_OPERATION_IDS.map((id) => {
      const op = operationSpec(id);
      return [
        id,
        {
          label: op.label,
          source: op.source,
          needs_voice: op.needsVoice,
          needs_language: op.needsLanguage,
          duration_seconds: op.duration,
          delivery: op.delivery,
          default_model: op.defaultModel,
          models: audioModelsOf(id),
          billed_per: op.billedPer,
          usd_per_unit: op.usdPerUnit
        }
      ];
    })
  );
}

const AUDIO_EXTRAS = () => ({ audio_operations: audioOperations(), dubbing_languages: DUBBING_LANGUAGES });

async function recommendedModels() {
  const catalogue = await canvasModelCatalogue();
  return Object.fromEntries(
    GEN_MEDIUMS.map((medium) => [
      medium,
      catalogue[medium].recommended.map(({ tier, id, label, why }) => ({ tier, id, label, why }))
    ])
  );
}

/**
 * LA FORMA DI `nodes.data`, PER CHI SCRIVE `insert_row`/`update_row` SENZA VEDERE IL CODICE.
 *
 * Non una seconda descrizione scritta a mano: `describeNodeType`/`describeNodeTypes` derivano il
 * JSON Schema dagli STESSI schemi Zod che `write-tool.ts` applica — questa rotta li mette solo
 * dietro HTTP, come `/org/query`. Un `type` nella querystring risponde per un tipo solo, senza
 * pagare gli altri otto quando il chiamante ne conosce già uno.
 */
export const GET: RequestHandler = async ({ request, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) return json(resolved.error.body, { status: resolved.error.status });

  const type = url.searchParams.get('type');
  if (type) {
    if (!isNodeType(type)) {
      return json({ error: 'unknown_type', message: `"${type}" is not a nodes.type value.` }, { status: 400 });
    }
    return json({ types: { [type]: describeNodeType(type) }, recommended_models: await recommendedModels(), ...AUDIO_EXTRAS() });
  }

  return json({ types: describeNodeTypes(), recommended_models: await recommendedModels(), ...AUDIO_EXTRAS() });
};
