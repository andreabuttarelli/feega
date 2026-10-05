import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { toolScope } from '$lib/server/dashboard/tool-scope';
import { studioOptions } from '$lib/server/studio/studio-options';
import { selectionSchema, startBatch, quoteSelection } from '$lib/server/studio/studio-batch';
import { addPhotoProduct } from '$lib/server/studio/studio-upload';
import { listBatches } from '$lib/server/repos/product-batches';
import { referenceLibrary } from '$lib/server/canvas/reference-library';
import { signedAssets } from '$lib/server/studio/studio-media';
import { gateOrgAiActionForForm } from '$lib/server/cli-auth';
import { orgCreditBalance } from '$lib/server/credits';
import { ENVIRONMENTS } from '$lib/studio/environments';
import { SHOTS } from '$lib/studio/shots';
import { SKIP_TEXT } from '$lib/studio/plan';

const HTTP_BAD_REQUEST = 400;
const HTTP_PAYMENT_REQUIRED = 402;
const HTTP_UNPROCESSABLE = 422;
const HTTP_SEE_OTHER = 303;
const RECENT_BATCHES = 6;

export const load: PageServerLoad = async (event) => {
  const { db, orgId, projectId } = await toolScope(event);
  const [options, batches, references, balance] = await Promise.all([
    studioOptions(db, { orgId, projectId }),
    listBatches(db, { orgId, projectId }),
    referenceLibrary(db, { orgId, projectId }),
    orgCreditBalance(db, orgId)
  ]);

  return {
    orgId,
    projectId,
    products: options.products.map(({ source: _source, ...p }) => p),
    models: options.models,
    imageModels: options.imageModels,
    defaultModel: options.defaultModel,
    previewModel: options.previewModel,
    environments: Object.entries(ENVIRONMENTS).map(([id, e]) => ({ id, label: e.label, hint: e.hint, preview: e.preview })),
    shots: Object.entries(SHOTS).map(([id, s]) => ({ id, label: s.label, casting: s.casting })),
    references: { catalogue: references.catalogue, media: references.media, mediaUrls: (await signedAssets(db, orgId, references.media.map((m) => m.id), 'pickerTile')).urls },
    batches: batches.slice(0, RECENT_BATCHES).map((b) => ({ id: b.id, name: b.name, status: b.status, createdAt: b.createdAt })),
    balance
  };
};

function parseSelection(raw: FormDataEntryValue | null) {
  try {
    return selectionSchema.safeParse(JSON.parse(String(raw ?? '')));
  } catch {
    return selectionSchema.safeParse(null);
  }
}

const PICK_SOMETHING = 'Pick a photo and a style first.';

export const actions: Actions = {
  upload: async (event) => {
    const scope = await toolScope(event);
    const form = await event.request.formData();
    const outcome = await addPhotoProduct(scope.db, scope, {
      path: String(form.get('path') ?? ''),
      fileName: String(form.get('file_name') ?? ''),
      mimeType: String(form.get('mime_type') ?? ''),
      bytes: Number(form.get('bytes') ?? 0),
      width: Number(form.get('width') ?? 0),
      height: Number(form.get('height') ?? 0)
    });
    return 'error' in outcome ? fail(outcome.status, { error: outcome.error }) : { product: outcome.product };
  },

  quote: async (event) => {
    const { db, orgId, projectId } = await toolScope(event);
    const parsed = parseSelection((await event.request.formData()).get('selection'));
    if (!parsed.success) {
      return fail(HTTP_BAD_REQUEST, { error: PICK_SOMETHING });
    }
    const quote = quoteSelection(parsed.data, await studioOptions(db, { orgId, projectId }));
    if ('error' in quote) {
      return fail(HTTP_UNPROCESSABLE, { error: quote.error });
    }
    return {
      quote: {
        count: quote.plan.items.length,
        overLimit: quote.plan.overLimit,
        perImage: quote.model.credits,
        total: quote.model.credits * quote.plan.items.length,
        droppedRefs: quote.droppedRefs,
        skipped: quote.plan.skipped.map((s) => `${s.productTitle} · ${SHOTS[s.shot].label}: ${SKIP_TEXT[s.reason]}`)
      }
    };
  },

  generate: async (event) => {
    const scope = await toolScope(event);
    const denied = await gateOrgAiActionForForm(scope.orgId);
    if (denied) {
      return fail(denied.status, { error: denied.data.message, shortfall: null });
    }
    const parsed = parseSelection((await event.request.formData()).get('selection'));
    if (!parsed.success) {
      return fail(HTTP_BAD_REQUEST, { error: PICK_SOMETHING, shortfall: null });
    }
    const outcome = await startBatch(scope.db, scope, parsed.data, await studioOptions(scope.db, scope));
    if ('error' in outcome) {
      return fail(outcome.shortfall ? HTTP_PAYMENT_REQUIRED : HTTP_UNPROCESSABLE, { error: outcome.error, shortfall: outcome.shortfall ?? null });
    }
    throw redirect(HTTP_SEE_OTHER, `/app/studio/${outcome.batchId}`);
  }
};
