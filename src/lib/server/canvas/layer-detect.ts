import type { Db } from '$lib/server/db/client';
import { findAsset } from '$lib/server/repos/assets';
import { signMediaPaths } from '$lib/server/canvas/sign-media';
import { llmText } from '$lib/server/llm';
import { withOrgContext } from '$lib/server/ai-log';
import { MAX_LAYERS, parseLayerBoxes, type LayerBox } from '$lib/layer-boxes';

const DETECT_SYSTEM = 'You locate the separable elements of a picture. Answer with JSON only.';

const DETECT_PROMPT = `List the ${MAX_LAYERS} most distinct foreground elements of this image (text blocks, objects, people, logos) that could each be cut out as their own layer. Answer with a JSON list, nothing else: [{"label": "short noun phrase", "bbox": [x1, y1, x2, y2]}]. Boxes use a 0-1000 grid over the whole image, x to the right, y downward, tight around the element.`;

export async function detectLayers(db: Db, scope: { orgId: string; assetId: string }): Promise<LayerBox[]> {
  const asset = await findAsset(db, scope);
  if (!asset || asset.type !== 'image') {
    return [];
  }

  const [imageUrl] = await signMediaPaths(db, [asset.url]);
  if (!imageUrl) {
    return [];
  }

  try {
    const { text } = await withOrgContext(scope.orgId, () => llmText({ prompt: DETECT_PROMPT, system: DETECT_SYSTEM, upstream: { imageUrls: [imageUrl] }, label: 'canvas.layers' }));
    return parseLayerBoxes(text);
  } catch {
    return [];
  }
}
