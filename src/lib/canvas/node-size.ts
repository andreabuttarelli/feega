import { isNodeType, type NodeType } from './node-data';
import { genNodeSize } from './gen-node';
import { iframeNodeSize } from './iframe-node';
import { docNodeSize } from './doc-node';
import { productsNodeSize } from './products-node';
import { socialFeedNodeSize } from './social-feed-node';
import { influencerNodeSize } from './influencer-node';
import { listNodeSize } from './list-node';
import { selectNodeSize } from './select-node';
import { effectsNodeSize } from './effects-node';
import { compositionNodeSize } from './composition-node';
import { calendarNodeSize } from './calendar-node';
import { DocNodeType, frameDefaultSize } from './motion-node';
import { studioBatchNodeSize } from './studio-batch-node';

type Size = { w: number; h: number };

const FALLBACK_SIZE: Size = { w: 320, h: 240 };
export const SECTION_SIZE: Size = { w: 640, h: 420 };
const TECHNIQUE_SIZE: Size = { w: 320, h: 180 };

const NODE_SIZE: Record<NodeType, (data: Record<string, unknown>) => Size> = {
  text: () => genNodeSize('text'),
  image: () => genNodeSize('image'),
  video: () => genNodeSize('video'),
  doc: docNodeSize,
  iframe: iframeNodeSize,
  social_account_feed: socialFeedNodeSize,
  social_post_mockup: () => FALLBACK_SIZE,
  products: productsNodeSize,
  ads: () => FALLBACK_SIZE,
  influencer: influencerNodeSize,
  list: listNodeSize,
  select: selectNodeSize,
  effects: effectsNodeSize,
  composition: compositionNodeSize,
  calendar: calendarNodeSize,
  audio: () => genNodeSize('audio'),
  model3d: () => genNodeSize('model3d'),
  motion: frameDefaultSize,
  element: (data) => frameDefaultSize(data, DocNodeType.Element),
  studio_batch: studioBatchNodeSize,
  section: () => SECTION_SIZE,
  technique: () => TECHNIQUE_SIZE
};

export function nodeSize(type: string, data: Record<string, unknown> = {}): Size {
  return isNodeType(type) ? NODE_SIZE[type](data) : FALLBACK_SIZE;
}
