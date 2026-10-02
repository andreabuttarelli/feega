import type { NodeType } from './node-data';
import type { ConnectorType } from './connectors';
import type { DuplicatePlan } from './duplicate-plan';
import { NANO_BANANA_2_MODEL, SEEDREAM_5_LITE_MODEL } from '$lib/image-models';
import { DEFAULT_MODEL } from './default-models';
import { nodeSize } from './node-size';
import { PLACEMENT_GAP } from './placement';
import { DEFAULT_MODEL3D_MODEL } from '$lib/model3d-models';

export type TemplateNode = {
  key: string;
  type: NodeType;
  col: number;
  row: number;
  data: Record<string, unknown>;
};

export type TemplateEdge = { from: string; to: string; handle: ConnectorType };

export const TEMPLATE_CATEGORIES = [
  { id: 'image', label: 'Image' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
  { id: '3d', label: '3D' },
  { id: 'social', label: 'Social' }
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]['id'];

export const ALL_TEMPLATES = 'all';

export type TemplateFilter = TemplateCategory | typeof ALL_TEMPLATES;

const THUMBNAIL_DIR = '/templates';

export type CanvasTemplate = {
  id: string;
  category: TemplateCategory;
  name: string;
  description: string;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
};

export const TEMPLATE_NODE_HALF = { x: 180, y: 230 };

const TEMPLATE_EDGE_KIND = 'derives_from';

const TEXT_MODEL = DEFAULT_MODEL.text;
const IMAGE_MODEL = NANO_BANANA_2_MODEL;
const CHEAP_IMAGE_MODEL = SEEDREAM_5_LITE_MODEL;
const VIDEO_MODEL = 'bytedance/seedance-2-fast';
const CHEAP_VIDEO_MODEL = 'bytedance/seedance-2-mini';
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

const video = (key: string, col: number, row: number, prompt: string, aspect_ratio = '9:16', model = VIDEO_MODEL): TemplateNode => ({
  key,
  type: 'video',
  col,
  row,
  data: { prompt, model, aspect_ratio, audio: true }
});

const styledClip = (style: { id: string; name: string; description: string; subject: string; look: string; motion: string }): CanvasTemplate => ({
  id: style.id,
  category: 'video',
  name: style.name,
  description: style.description,
  nodes: [
    note('subject', 0, 0, `${style.subject} Replace with your own.`),
    image('frame', 1, 0, `Opening frame for a vertical clip about the subject in the input. ${style.look}`, '9:16', CHEAP_IMAGE_MODEL),
    video('clip', 2, 0, style.motion, '9:16', CHEAP_VIDEO_MODEL)
  ],
  edges: [
    { from: 'subject', to: 'frame', handle: 'text' },
    { from: 'frame', to: 'clip', handle: 'first_frame' }
  ]
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

const model3d = (key: string, col: number, row: number): TemplateNode => ({
  key,
  type: 'model3d',
  col,
  row,
  data: { prompt: '', model: DEFAULT_MODEL3D_MODEL }
});

const PRODUCT_SHOT =
  'Studio packshot of a minimalist ceramic coffee mug on a seamless off-white background, soft daylight, product centred. Replace this with your own product.';

const STYLE_SOURCE = 'Portrait photo of a smiling young woman in a denim jacket on a city street, natural light. Replace this with your own photo.';

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: 'product-lifestyle',
    category: 'image',
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
    id: 'product-3d',
    category: '3d',
    name: 'Product → 3D model',
    description: 'One product photo becomes a 3D model you can spin, download as GLB and render from any side.',
    nodes: [image('product', 0, 0, PRODUCT_SHOT, '1:1'), model3d('model', 1, 0)],
    edges: [{ from: 'product', to: 'model', handle: 'images' }]
  },
  {
    id: 'text-3d',
    category: '3d',
    name: 'Text → 3D model',
    description: 'Describe an object and get a 3D model: a product shot is drawn first, then turned into a GLB.',
    nodes: [note('object', 0, 0, 'A silver bell with gilded leaves on top. Replace this with your own object.'), model3d('model', 1, 0)],
    edges: [{ from: 'object', to: 'model', handle: 'text' }]
  },
  {
    id: 'ugc-video-ad',
    category: 'video',
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
    category: 'video',
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
    category: 'video',
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
    category: 'image',
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
    category: 'audio',
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
    category: 'audio',
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
    category: 'image',
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
    category: 'social',
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
    category: 'social',
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
    category: 'video',
    name: 'Product teaser with sound',
    description: 'A hero shot animated into a short teaser, with a matching sound effect.',
    nodes: [
      image('hero', 0, 0, 'Dramatic hero shot of a matte black wireless earbud case on wet black stone, rim light, mist. Replace with your own product.', '9:16'),
      video('teaser', 1, 0, 'The case slowly opens, the earbuds rise with a soft glow, mist swirls, slow motion, premium product teaser.'),
      soundEffect('whoosh', 1, 1, 'Deep cinematic whoosh with a soft magnetic click at the end.')
    ],
    edges: [{ from: 'hero', to: 'teaser', handle: 'first_frame' }]
  },
  styledClip({
    id: 'anime-video',
    name: 'Anime video',
    description: 'A subject drawn as a 90s anime cel, then animated into a vertical clip.',
    subject: 'Subject: a girl with a red scarf on a Tokyo rooftop at dusk, wind in her hair.',
    look: '90s anime cel style: clean line art, flat shading, painted sky background, film grain.',
    motion: 'Anime-style animation: hair and scarf flutter in the wind, clouds drift, slow camera push-in, limited-animation feel.'
  }),
  styledClip({
    id: 'claymation-video',
    name: 'Claymation video',
    description: 'A subject sculpted in plasticine, then animated stop-motion style.',
    subject: 'Subject: a small fox baker pulling a loaf out of a wood oven in a cosy kitchen.',
    look: 'Stop-motion claymation: plasticine textures with fingerprints, miniature set, soft studio lighting.',
    motion: 'Stop-motion animation at 12 frames per second: the fox lifts the loaf and smiles, steam rises, slight jitter between frames.'
  }),
  styledClip({
    id: 'paper-cutout',
    name: 'Paper cutout animation',
    description: 'A layered paper-craft scene, then animated like a cutout puppet show.',
    subject: 'Subject: a whale swimming over a sleeping seaside village under the moon.',
    look: 'Layered paper cutout diorama: visible paper texture, soft drop shadows between layers, muted pastel palette.',
    motion: 'Paper cutout animation: layers slide with parallax, the whale glides across, stars twinkle, slight stop-motion stutter.'
  }),
  styledClip({
    id: 'retro-vhs',
    name: '80s retro VHS video',
    description: 'A neon 80s still with VHS artefacts, then animated as a retro clip.',
    subject: 'Subject: a skater cruising down a neon-lit boulevard at night, palm trees, synthwave sunset.',
    look: '80s VHS still: neon magenta and cyan, tracking lines, colour bleed, grain, timestamp in the corner.',
    motion: 'Retro 80s footage: the skater rolls toward camera, neon signs flicker, VHS tracking glitches, slight tape wobble.'
  }),
  styledClip({
    id: '3d-animation',
    name: '3D animation',
    description: 'A glossy 3D character render, then animated like an animated-feature shot.',
    subject: 'Subject: a curious little robot discovering a flower in a sunny meadow.',
    look: 'Glossy 3D animated-feature render: soft global illumination, subsurface materials, shallow depth of field.',
    motion: '3D animated-feature shot: the robot tilts its head, reaches for the flower, petals sway, gentle camera orbit.'
  }),
  {
    id: 'spotify-canvas',
    category: 'video',
    name: 'Spotify Canvas loop',
    description: 'Album-art style still turned into a seamless vertical loop for Spotify Canvas.',
    nodes: [
      note('track', 0, 0, 'Track: a dreamy synth-pop song about driving at night. Replace with your own.'),
      image('art', 1, 0, 'Vertical visual for the track described in the input: album-art mood, one strong central subject, no text.', '9:16', CHEAP_IMAGE_MODEL),
      video('loop', 2, 0, 'Seamless loop: subtle ambient motion only — light shimmer, drifting particles, slow breathing camera. Ends exactly where it starts.', '9:16', CHEAP_VIDEO_MODEL)
    ],
    edges: [
      { from: 'track', to: 'art', handle: 'text' },
      { from: 'art', to: 'loop', handle: 'first_frame' },
      { from: 'art', to: 'loop', handle: 'last_frame' }
    ]
  },
  {
    id: 'ai-commercial',
    category: 'video',
    name: 'AI commercial',
    description: 'Product photo to hero shot to a cinematic ad clip, with a voice-over.',
    nodes: [
      image('product', 0, 0, PRODUCT_SHOT, '1:1', CHEAP_IMAGE_MODEL),
      image('hero', 1, 0, 'Cinematic commercial hero shot of the product from the reference on a sunlit marble counter, dramatic light. Keep the product identical.', '16:9', CHEAP_IMAGE_MODEL),
      video('ad', 2, 0, 'Premium TV commercial shot: slow dolly-in on the product, light sweeps across it, shallow depth of field.', '16:9', CHEAP_VIDEO_MODEL),
      text('script', 0, 1, 'Write a 10-second TV commercial voice-over for this product: one bold claim, one benefit, the brand name at the end. Spoken sentences only.'),
      voiceOver('voice', 1, 1)
    ],
    edges: [
      { from: 'product', to: 'hero', handle: 'images' },
      { from: 'hero', to: 'ad', handle: 'first_frame' },
      { from: 'script', to: 'voice', handle: 'text' }
    ]
  },
  {
    id: 'text-to-video',
    category: 'video',
    name: 'Text → video',
    description: 'Describe a scene in words; the brief writes the shot and the video renders it.',
    nodes: [
      text('brief', 0, 0, 'Write one cinematic video prompt (max 60 words) for a 5-second vertical shot of: a hot-air balloon rising over misty mountains at sunrise.'),
      video('clip', 1, 0, '', '9:16', CHEAP_VIDEO_MODEL)
    ],
    edges: [{ from: 'brief', to: 'clip', handle: 'text' }]
  },
  {
    id: 'hd-clip',
    category: 'video',
    name: 'Sharp HD clip',
    description: 'A detailed still animated at 1080p. To upscale a clip you already have, upload it and pick FLUX Video Upscale.',
    nodes: [
      note('how', 0, 1, 'To upscale an existing clip: upload it to the canvas, select it and choose the FLUX Video Upscale model. The nodes on the right make a new sharp clip instead.'),
      image('still', 1, 0, 'Ultra-detailed 16:9 landscape photo: a lighthouse on a cliff in a storm, crashing waves, crisp textures, 8k detail.', '16:9', CHEAP_IMAGE_MODEL),
      {
        key: 'clip',
        type: 'video',
        col: 2,
        row: 0,
        data: { prompt: 'Waves crash against the cliff, rain sweeps across, lighthouse beam rotates, steady tripod shot.', model: CHEAP_VIDEO_MODEL, aspect_ratio: '16:9', resolution: '1080p', audio: true }
      }
    ],
    edges: [{ from: 'still', to: 'clip', handle: 'first_frame' }]
  }
];

export function templateById(id: string): CanvasTemplate | undefined {
  return CANVAS_TEMPLATES.find((t) => t.id === id);
}

export function templatesIn(filter: TemplateFilter): CanvasTemplate[] {
  if (filter === ALL_TEMPLATES) {
    return CANVAS_TEMPLATES;
  }
  return CANVAS_TEMPLATES.filter((t) => t.category === filter);
}

export function templateThumbnail(template: CanvasTemplate): string {
  return `${THUMBNAIL_DIR}/${template.id}.webp`;
}

export function templateNodeTypes(template: CanvasTemplate): NodeType[] {
  return [...new Set(template.nodes.map((n) => n.type))];
}

const middle = (values: number[]) => (Math.min(...values) + Math.max(...values)) / 2;

export function planTemplate(template: CanvasTemplate, at: { x: number; y: number }): DuplicatePlan {
  const midCol = middle(template.nodes.map((n) => n.col));
  const midRow = middle(template.nodes.map((n) => n.row));
  const indexOf = new Map(template.nodes.map((n, i) => [n.key, i]));
  const sizes = template.nodes.map((n) => nodeSize(n.type));
  const step = { x: Math.max(...sizes.map((z) => z.w)) + PLACEMENT_GAP, y: Math.max(...sizes.map((z) => z.h)) + PLACEMENT_GAP };

  const nodes = template.nodes.map((n, i) => ({
    sourceIndex: i,
    type: n.type,
    data: structuredClone(n.data),
    x: at.x - TEMPLATE_NODE_HALF.x + (n.col - midCol) * step.x,
    y: at.y - TEMPLATE_NODE_HALF.y + (n.row - midRow) * step.y
  }));

  const edges = template.edges.map((e) => ({
    sourceIndex: indexOf.get(e.from)!,
    targetIndex: indexOf.get(e.to)!,
    sourceHandle: TEMPLATE_EDGE_KIND,
    targetHandle: e.handle
  }));

  return { nodes, edges };
}
