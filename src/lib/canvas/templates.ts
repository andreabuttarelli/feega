import type { NodeType } from './node-data';
import type { ConnectorType } from './connectors';
import type { DuplicatePlan } from './duplicate-plan';
import { NANO_BANANA_2_MODEL, SEEDREAM_5_LITE_MODEL } from '$lib/image-models';
import { DEFAULT_MODEL } from './default-models';

export type TemplateNode = {
  key: string;
  type: NodeType;
  col: number;
  row: number;
  data: Record<string, unknown>;
};

export type TemplateEdge = { from: string; to: string; handle: ConnectorType };

export type CanvasTemplate = {
  id: string;
  name: string;
  description: string;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
};

export const TEMPLATE_STEP = { x: 440, y: 520 };

export const TEMPLATE_NODE_HALF = { x: 180, y: 230 };

const TEMPLATE_EDGE_KIND = 'derives_from';

const TEXT_MODEL = DEFAULT_MODEL.text;
const IMAGE_MODEL = NANO_BANANA_2_MODEL;
const CHEAP_IMAGE_MODEL = SEEDREAM_5_LITE_MODEL;
const VIDEO_MODEL = 'bytedance/seedance-2-fast';
const VOICE_MODEL = 'eleven_multilingual_v2';
const MUSIC_MODEL = 'music_v1';
const SFX_MODEL = 'eleven_text_to_sound_v2';

const text = (key: string, col: number, row: number, prompt: string): TemplateNode => ({
  key,
  type: 'text',
  col,
  row,
  data: { prompt, model: TEXT_MODEL }
});

const note = (key: string, col: number, row: number, content: string): TemplateNode => ({
  key,
  type: 'doc',
  col,
  row,
  data: { content, public: false }
});

const image = (key: string, col: number, row: number, prompt: string, aspect_ratio = '4:5', model = IMAGE_MODEL): TemplateNode => ({
  key,
  type: 'image',
  col,
  row,
  data: { prompt, model, aspect_ratio }
});

const video = (key: string, col: number, row: number, prompt: string, aspect_ratio = '9:16'): TemplateNode => ({
  key,
  type: 'video',
  col,
  row,
  data: { prompt, model: VIDEO_MODEL, aspect_ratio, audio: true }
});

const voiceOver = (key: string, col: number, row: number): TemplateNode => ({
  key,
  type: 'audio',
  col,
  row,
  data: { prompt: '', model: VOICE_MODEL, params: { operation: 'text_to_speech' } }
});

const music = (key: string, col: number, row: number, prompt: string, duration = 30): TemplateNode => ({
  key,
  type: 'audio',
  col,
  row,
  data: { prompt, model: MUSIC_MODEL, params: { operation: 'music', duration } }
});

const soundEffect = (key: string, col: number, row: number, prompt: string): TemplateNode => ({
  key,
  type: 'audio',
  col,
  row,
  data: { prompt, model: SFX_MODEL, params: { operation: 'sound_effects', duration: 5 } }
});

const PRODUCT_SHOT =
  'Studio packshot of a minimalist ceramic coffee mug on a seamless off-white background, soft daylight, product centred. Replace this with your own product.';

const STYLE_SOURCE = 'Portrait photo of a smiling young woman in a denim jacket on a city street, natural light. Replace this with your own photo.';

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: 'product-lifestyle',
    name: 'Product → lifestyle shots',
    description: 'One product photo becomes three lifestyle scenes for a carousel.',
    nodes: [
      image('product', 0, 1, PRODUCT_SHOT, '1:1'),
      image('kitchen', 1, 0, 'Place the product from the reference in a bright Scandinavian kitchen, morning light, shallow depth of field. Keep the product identical.'),
      image('outdoor', 1, 1, 'Place the product from the reference on a café table outdoors, golden hour, people blurred in the background. Keep the product identical.'),
      image('flatlay', 1, 2, 'Top-down flat lay of the product from the reference with matching props on linen, editorial style. Keep the product identical.')
    ],
    edges: [
      { from: 'product', to: 'kitchen', handle: 'images' },
      { from: 'product', to: 'outdoor', handle: 'images' },
      { from: 'product', to: 'flatlay', handle: 'images' }
    ]
  },
  {
    id: 'ugc-video-ad',
    name: 'UGC video ad',
    description: 'A creator-style clip with the product, plus a voice-over script.',
    nodes: [
      image('product', 0, 0, PRODUCT_SHOT, '1:1'),
      image('creator', 1, 0, 'A friendly creator in their twenties holding the product from the reference to camera in a cosy bedroom, selfie angle, natural phone-camera look.', '9:16'),
      video('clip', 2, 0, 'Handheld selfie video: the creator shows the product to camera, smiles and talks enthusiastically, slight natural camera shake, authentic UGC style.'),
      text('script', 0, 1, 'Write a 20-second UGC voice-over for this product: hook in the first 3 seconds, one benefit, one call to action. Plain spoken sentences only, no stage directions.'),
      voiceOver('voice', 1, 1)
    ],
    edges: [
      { from: 'product', to: 'creator', handle: 'images' },
      { from: 'creator', to: 'clip', handle: 'first_frame' },
      { from: 'script', to: 'voice', handle: 'text' }
    ]
  },
  {
    id: 'start-end-video',
    name: 'Start → end frame video',
    description: 'Two stills define where a clip begins and ends; the video fills the motion.',
    nodes: [
      image('start', 0, 0, 'A closed gift box with a satin ribbon on a marble table, soft studio light.', '9:16'),
      image('end', 0, 1, 'The same gift box open on a marble table, a glowing perfume bottle inside, soft studio light.', '9:16'),
      video('clip', 1, 0, 'Smooth cinematic transition: the ribbon unties and the box opens to reveal the product, slow push-in.')
    ],
    edges: [
      { from: 'start', to: 'clip', handle: 'first_frame' },
      { from: 'end', to: 'clip', handle: 'last_frame' }
    ]
  },
  {
    id: 'brief-to-reel',
    name: 'Brief → image → reel',
    description: 'A text brief writes the visual, the image becomes the first frame of a reel.',
    nodes: [
      text('brief', 0, 0, 'Write one vivid image prompt (max 60 words) for a vertical Instagram reel opening shot about: sustainable sneakers made from recycled ocean plastic.'),
      image('frame', 1, 0, '', '9:16'),
      video('reel', 2, 0, 'Slow dolly-in on the scene, subtle parallax, ambient motion, cinematic.')
    ],
    edges: [
      { from: 'brief', to: 'frame', handle: 'text' },
      { from: 'frame', to: 'reel', handle: 'first_frame' }
    ]
  },
  {
    id: 'style-transfer',
    name: 'Style transfer pack',
    description: 'One photo redrawn as claymation, 80s VHS, anime and 3D render.',
    nodes: [
      image('photo', 0, 1, STYLE_SOURCE, '4:5'),
      image('clay', 1, 0, 'Recreate the reference image as stop-motion claymation: plasticine textures, fingerprints, soft studio lighting. Keep composition and subject.'),
      image('vhs', 1, 1, 'Recreate the reference image as an 80s VHS still: tracking lines, colour bleed, grain, timestamp in the corner. Keep composition and subject.'),
      image('anime', 2, 0, 'Recreate the reference image as a 90s anime cel: clean line art, flat shading, painted background. Keep composition and subject.'),
      image('render', 2, 1, 'Recreate the reference image as a glossy 3D character render, Pixar-like, soft global illumination. Keep composition and subject.')
    ],
    edges: [
      { from: 'photo', to: 'clay', handle: 'images' },
      { from: 'photo', to: 'vhs', handle: 'images' },
      { from: 'photo', to: 'anime', handle: 'images' },
      { from: 'photo', to: 'render', handle: 'images' }
    ]
  },
  {
    id: 'voice-over',
    name: 'Script → voice-over',
    description: 'Write a script and turn it into a voice-over with a music bed.',
    nodes: [
      text('script', 0, 0, 'Write a 30-second voice-over script announcing a weekend sale for an independent bookshop. Warm, conversational, no stage directions.'),
      voiceOver('voice', 1, 0),
      music('bed', 1, 1, 'Warm lo-fi acoustic background music, relaxed tempo, no vocals, suitable under a voice-over.')
    ],
    edges: [{ from: 'script', to: 'voice', handle: 'text' }]
  },
  {
    id: 'podcast-intro',
    name: 'Podcast intro',
    description: 'Host intro, theme music and a transition sting for an episode.',
    nodes: [
      note('topic', 0, 0, 'Episode topic: how small brands grow on TikTok without ads. Replace with your own.'),
      text('intro', 1, 0, 'Write a 15-second podcast host intro for the episode described in the input: greet listeners, name the topic, tease one insight. Spoken sentences only.'),
      voiceOver('host', 2, 0),
      music('theme', 1, 1, 'Upbeat modern podcast theme, punchy drums and synth, 15 seconds, no vocals.', 15),
      soundEffect('sting', 2, 1, 'Short whoosh transition sting for a podcast segment change.')
    ],
    edges: [
      { from: 'topic', to: 'intro', handle: 'text' },
      { from: 'intro', to: 'host', handle: 'text' },
      { from: 'topic', to: 'theme', handle: 'text' }
    ]
  },
  {
    id: 'moodboard',
    name: 'Brand moodboard',
    description: 'A brand description becomes four moodboard tiles.',
    nodes: [
      note('brand', 0, 1, 'Describe the brand in 3 lines: a small-batch natural skincare label, earthy, calm, Mediterranean. Replace with your own brand.'),
      image('texture', 1, 0, 'Moodboard tile: close-up material texture that captures the brand described in the input.', '1:1', CHEAP_IMAGE_MODEL),
      image('palette', 1, 1, 'Moodboard tile: still life whose colours form the palette of the brand described in the input.', '1:1', CHEAP_IMAGE_MODEL),
      image('lifestyle', 2, 0, 'Moodboard tile: lifestyle photo of the brand’s ideal customer, as described in the input.', '1:1', CHEAP_IMAGE_MODEL),
      image('poster', 2, 1, 'Moodboard tile: minimal typographic poster with the brand’s tone of voice, as described in the input.', '1:1', CHEAP_IMAGE_MODEL)
    ],
    edges: [
      { from: 'brand', to: 'texture', handle: 'text' },
      { from: 'brand', to: 'palette', handle: 'text' },
      { from: 'brand', to: 'lifestyle', handle: 'text' },
      { from: 'brand', to: 'poster', handle: 'text' }
    ]
  },
  {
    id: 'caption-pack',
    name: 'One idea, every platform',
    description: 'A single idea rewritten for Instagram, TikTok, LinkedIn and X.',
    nodes: [
      note('idea', 0, 1, 'The idea: we switched our packaging to 100% compostable materials. Replace with your own.'),
      text('instagram', 1, 0, 'Write an Instagram caption for the idea in the input: hook line, 3 short lines, 5 relevant hashtags.'),
      text('tiktok', 1, 1, 'Write a TikTok on-screen hook (max 8 words) and a 1-line caption for the idea in the input.'),
      text('linkedin', 2, 0, 'Write a LinkedIn post for the idea in the input: professional, first person, 80–120 words, one question at the end.'),
      text('x', 2, 1, 'Write a post for X about the idea in the input, under 260 characters, no hashtags.')
    ],
    edges: [
      { from: 'idea', to: 'instagram', handle: 'text' },
      { from: 'idea', to: 'tiktok', handle: 'text' },
      { from: 'idea', to: 'linkedin', handle: 'text' },
      { from: 'idea', to: 'x', handle: 'text' }
    ]
  },
  {
    id: 'thumbnail-cover',
    name: 'Thumbnail + story cover',
    description: 'One title becomes a YouTube thumbnail and a vertical story cover.',
    nodes: [
      note('title', 0, 0, 'Video title: I tried 5 viral TikTok recipes in one day. Replace with your own.'),
      image('thumbnail', 1, 0, 'High-contrast YouTube thumbnail for the video titled in the input: expressive face, bold 3-word text, bright background.', '16:9'),
      image('cover', 2, 0, 'Vertical story cover in the same style as the reference thumbnail, text reflowed for 9:16.', '9:16')
    ],
    edges: [
      { from: 'title', to: 'thumbnail', handle: 'text' },
      { from: 'thumbnail', to: 'cover', handle: 'images' }
    ]
  },
  {
    id: 'product-teaser',
    name: 'Product teaser with sound',
    description: 'A hero shot animated into a short teaser, with a matching sound effect.',
    nodes: [
      image('hero', 0, 0, 'Dramatic hero shot of a matte black wireless earbud case on wet black stone, rim light, mist. Replace with your own product.', '9:16'),
      video('teaser', 1, 0, 'The case slowly opens, the earbuds rise with a soft glow, mist swirls, slow motion, premium product teaser.'),
      soundEffect('whoosh', 1, 1, 'Deep cinematic whoosh with a soft magnetic click at the end.')
    ],
    edges: [{ from: 'hero', to: 'teaser', handle: 'first_frame' }]
  }
];

export function templateById(id: string): CanvasTemplate | undefined {
  return CANVAS_TEMPLATES.find((t) => t.id === id);
}

const middle = (values: number[]) => (Math.min(...values) + Math.max(...values)) / 2;

export function planTemplate(template: CanvasTemplate, at: { x: number; y: number }): DuplicatePlan {
  const midCol = middle(template.nodes.map((n) => n.col));
  const midRow = middle(template.nodes.map((n) => n.row));
  const indexOf = new Map(template.nodes.map((n, i) => [n.key, i]));

  const nodes = template.nodes.map((n, i) => ({
    sourceIndex: i,
    type: n.type,
    data: structuredClone(n.data),
    x: at.x - TEMPLATE_NODE_HALF.x + (n.col - midCol) * TEMPLATE_STEP.x,
    y: at.y - TEMPLATE_NODE_HALF.y + (n.row - midRow) * TEMPLATE_STEP.y
  }));

  const edges = template.edges.map((e) => ({
    sourceIndex: indexOf.get(e.from)!,
    targetIndex: indexOf.get(e.to)!,
    sourceHandle: TEMPLATE_EDGE_KIND,
    targetHandle: e.handle
  }));

  return { nodes, edges };
}
