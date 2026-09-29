import type { NodeType } from './node-data';

export const NODE_EMPTY_HINT: Record<NodeType, string> = {
  text: 'Write a prompt to generate text.',
  image: 'Write a prompt to generate an image.',
  video: 'Write a prompt to generate a video.',
  doc: 'Empty document.',
  iframe: 'Add a URL or some HTML.',
  social_account_feed: 'Pick an account to sync its posts.',
  social_post_mockup: 'Connect an image or a text to preview the post.',
  products: 'Add a store URL to import products.',
  ads: 'Search a brand or a keyword to see its ads.',
  influencer: 'Pick someone from the Influencers panel.',
  list: 'Add items to the list.',
  select: 'Connect a list to pick one item.',
  effects: 'Connect an image or a video to apply effects.',
  composition: 'Connect images to compose them.',
  audio: 'Pick an operation, then write or connect what to voice.'
};
