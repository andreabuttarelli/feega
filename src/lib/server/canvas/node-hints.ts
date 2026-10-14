import type { Db } from '$lib/server/db/client';
import { listNodes } from '$lib/server/repos/canvas';
import { upstreamInputsFor } from '$lib/server/canvas/upstream';
import { estimateCanvasTextCost } from '$lib/server/canvas/text-cost-estimate';
import { suggestNextSteps } from '$lib/canvas/suggest-next-steps';
import { actionFrequencyFor } from '$lib/server/next-step-stats';
import { decideWithJev } from '$lib/server/jev';

type NodeScope = { orgId: string; canvasId: string; nodeId: string };

const jevDecide = () => (process.env.TYPESAFE_API_KEY ? decideWithJev : null);

export async function nodeTextCost(db: Db, input: NodeScope & { prompt: string; model: string | null }) {
  const upstream = await upstreamInputsFor(db, {
    orgId: input.orgId,
    canvasId: input.canvasId,
    nodeId: input.nodeId,
    model: input.model,
    medium: 'text'
  });
  return estimateCanvasTextCost({
    material: upstream.text,
    ownPrompt: input.prompt,
    inputCost:
      upstream.referenceImageUrls.length > 0 ||
      upstream.referenceVideoUrls.length > 0 ||
      upstream.referenceAudioUrls.length > 0
        ? 'variable_media'
        : 'fixed',
    decide: jevDecide()
  });
}

export async function nextStepsFor(db: Db, scope: NodeScope) {
  const node = (await listNodes(db, scope)).find((n) => n.id === scope.nodeId);
  if (!node) {
    return null;
  }

  const frequency = await actionFrequencyFor(db, scope.orgId, node.type);
  const suggestions = await suggestNextSteps(node.type, frequency, jevDecide(), node.data);

  return suggestions.map((s) => ({
    id: s.action.id,
    label: s.action.label,
    createsNodeType: s.action.createsNodeType,
    wiring: s.action.wiring,
    promptTemplate: s.action.promptTemplate,
    confidence: s.confidence
  }));
}
