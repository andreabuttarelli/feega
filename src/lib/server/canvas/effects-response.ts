import { json } from '@sveltejs/kit';
import type { EffectsOutcome } from './effects-actions';

const HTTP_BAD_REQUEST = 400;
const HTTP_CONFLICT = 409;

export function effectsResponse(out: EffectsOutcome): Response {
  if (out.outcome === 'refused') {
    return json({ error: out.error }, { status: HTTP_BAD_REQUEST });
  }
  if (out.outcome === 'conflict') {
    return json({ conflict: true }, { status: HTTP_CONFLICT });
  }
  return json({ node_id: out.nodeId, asset_id: out.assetId });
}
