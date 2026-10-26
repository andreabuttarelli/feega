const VIDEO_BASE = 'https://klnswzhhgrqvbfjzioul.supabase.co/storage/v1/object/public/website';

export enum Aspect {
  Square = '1 / 1',
  Wide = '16 / 9',
  Portrait = '4 / 5',
  Tall = '9 / 16'
}

export type ShowcaseVideo = { readonly file: string; readonly aspect: Aspect };

const video = (file: string, aspect: Aspect): ShowcaseVideo => ({ file: `${VIDEO_BASE}/${file}`, aspect });

const V = {
  liquidGlass: video('liquid-glass-1x1.MP4', Aspect.Square),
  uiMorph: video('ui-morph-v2.mp4', Aspect.Square),
  draft: video('draft-wide.mp4', Aspect.Wide),
  split: video('split-headline-16x9.mp4', Aspect.Wide),
  featureScroll: video('feature-scroll-dark-centred-16x9.mp4', Aspect.Wide),
  ring: video('ring-through-title-16x9.MP4', Aspect.Wide),
  masking: video('masking-loop-v3.MP4', Aspect.Wide),
  launch: video('launch.MP4', Aspect.Wide),
  sting: video('sting-loop-1x1.mp4', Aspect.Square),
  preview: video('preview-wide.mp4', Aspect.Wide),
  melting: video('melting-type-poster-4x5.MP4', Aspect.Portrait),
  showcase: video('feega-showcase-v2.mp4', Aspect.Wide),
  demo: video('demo-v2.MP4', Aspect.Wide),
  pills: video('2-dark-pill-chips.mp4', Aspect.Wide),
  scrollStory: video('scroll-story-default.mp4', Aspect.Wide),
  phoneChat: video('phone-chat-1x1-720.MP4', Aspect.Square),
  uiRing: video('ui-ring-farm.MP4', Aspect.Wide),
  poster: video('poster-liquid-glass-4x5.MP4', Aspect.Portrait),
  floating: video('floating-media-default.mp4', Aspect.Wide),
  blobs: video('iridescent-blobs-9x16-720%20(1).MP4', Aspect.Tall),
  mediaCloud: video('media-cloud-white-16x9-720p.MP4', Aspect.Wide)
};

export const SHOWCASE_WIDE: readonly (readonly ShowcaseVideo[])[] = [
  [V.liquidGlass, V.uiMorph, V.draft, V.split, V.featureScroll, V.ring],
  [V.masking, V.launch, V.sting, V.preview, V.melting],
  [V.showcase, V.demo, V.pills, V.scrollStory, V.phoneChat],
  [V.uiRing, V.poster, V.floating, V.blobs, V.mediaCloud]
];

export const SHOWCASE_NARROW: readonly (readonly ShowcaseVideo[])[] = [
  [V.liquidGlass, V.showcase, V.uiMorph, V.demo, V.draft, V.pills, V.split, V.scrollStory, V.featureScroll, V.phoneChat, V.ring],
  [V.masking, V.uiRing, V.launch, V.poster, V.sting, V.floating, V.preview, V.blobs, V.melting, V.mediaCloud]
];

export const DISCIPLINES = ['Art Direction', 'Brand Identity', 'Visual Design', 'Fashion', 'Ecommerce', 'Filmmaking'] as const;

export const DISCIPLINE_IMAGES = ['more-2', 'more-1', 'more-3', 'more-4'] as const;

export type Model = { readonly name: string; readonly slug: string };

export const FEATURED_MODELS = [
  { name: 'GPT Images 2.5', maker: 'OpenAI', slug: 'neuroline' },
  { name: 'Nano Banana 2', maker: 'Google', slug: 'voltage' }
] as const;

export const MODEL_ROWS: readonly (readonly (Model & { readonly col: number })[])[] = [
  [
    { name: 'Seedance 2.5', slug: 'voltage', col: 1 },
    { name: 'Opus 5.5', slug: 'neuroline', col: 3 },
    { name: 'Kling 3.0', slug: 'lumen-east', col: 5 },
    { name: 'GPT 6 Astra', slug: 'rift-studio', col: 7 }
  ],
  [
    { name: 'Grok Imagine', slug: 'pulse', col: 2 },
    { name: 'Seedream 5.0', slug: 'origin', col: 4 },
    { name: 'Qwen 3.0 Pro', slug: 'flux', col: 6 }
  ],
  [
    { name: 'DeepSeek 4.1', slug: 'haven', col: 3 },
    { name: 'MAI Image 2.6', slug: 'aero', col: 5 }
  ],
  [
    { name: 'Meta Muse', slug: 'nova', col: 2 },
    { name: 'Recraft', slug: 'axis', col: 4 },
    { name: 'Recraft', slug: 'evolve', col: 6 }
  ]
];

export const PLAN_FEATURES = [
  'All models',
  'Unlimited canvases & projects',
  'Smart brand & products import',
  'AI assistant in-editor',
  'AI influencers',
  'Image & video effects',
  'HD download',
  'Gif download',
  'Personal & Commercial Use rights',
  '4k generation'
] as const;

export const PLAN_CREDITS = [8, 16, 32, 64, 128, 256] as const;

const MCP_URL = 'https://mcp.feega.app/mcp';

export const AGENT_SETUPS = [
  { id: 'claude-code', label: 'Claude Code', code: `claude mcp add --transport http feega ${MCP_URL}` },
  {
    id: 'claude-app',
    label: 'Claude Mobile & Desktop',
    code: `Add Feega to Claude

Feega is a remote MCP server, so there is nothing to install.

Server URL: ${MCP_URL}

- Open Claude on the web or desktop (mobile can't add new servers).
- Go to Customize > Connectors (older versions: Settings > Connectors).
- Click Add custom connector.
- Paste the URL above, name it "Feega", and click Add.
- Click Connect and sign in to your Feega account when the browser window opens.`
  },
  { id: 'codex', label: 'Codex', code: `codex mcp add feega --url ${MCP_URL}\ncodex mcp login feega` },
  {
    id: 'cursor',
    label: 'Cursor',
    code: `{
  "mcpServers": {
    "feega": {
      "url": "${MCP_URL}"
    }
  }
}`
  }
] as const;

export const FAQ = [
  {
    q: 'What is feega?',
    a: 'feega is an AI creative workspace: an infinite canvas where creators and brands generate and edit images, video, audio and text, then plan and publish their social content. Google Sign-In is used only for authentication; no Google API is used to generate or edit content.'
  },
  {
    q: 'How does the canvas work?',
    a: 'Everything is a node on an infinite canvas: text, images, video, audio, documents, products and more. Connect nodes to pass one output into the next as input, then run a node to generate. You can chain steps into a full workflow and rerun any of them.'
  },
  {
    q: 'Which AI models can I use?',
    a: 'Image, video, audio and text models from many providers, including Google, OpenAI, ElevenLabs and ByteDance. You pick the model for each node, so you can compare and switch freely.'
  },
  {
    q: 'What file formats can I upload and download?',
    a: 'You can upload images (JPEG, PNG, GIF, WebP, AVIF, HEIC, SVG) and video. Generated images and videos download as standard files, such as PNG, WebP and MP4.'
  },
  {
    q: 'Can I collaborate with my team in real time?',
    a: 'Yes. Invite teammates to your workspace as members or admins: everyone works on the same canvas and sees changes and who is online live.'
  },
  {
    q: 'Can I plan and publish to social accounts?',
    a: 'Yes. Connect Instagram, Facebook, TikTok, YouTube, LinkedIn, X, Threads, Pinterest or Reddit, plan posts on the calendar and publish or schedule them after you approve. Publishing uses only the platforms’ official APIs.'
  },
  {
    q: 'Can AI agents use feega?',
    a: 'Yes. Agents like Claude or Codex can work on your canvas through our MCP server, REST API and command-line tool, acting on your behalf with your permissions.'
  },
  {
    q: 'Are generated files marked as AI-generated?',
    a: 'Yes. Every image and video feega renders carries a machine-readable AI-generated marker in the file, and when we publish for you we set the platform’s AI-content label where one exists. See <a href="/ai-transparency">AI Transparency</a>.'
  },
  {
    q: 'Who owns what I create?',
    a: 'You keep ownership of the content you bring, and you may use what you generate for your own business purposes, subject to our <a href="/terms">Terms</a> and third-party rights.'
  },
  {
    q: 'Is my content used to train AI?',
    a: 'No. We do not use your prompts, uploads or generated content to train AI models. See our <a href="/privacy">Privacy Policy</a>.'
  },
  {
    q: 'How is content kept safe?',
    a: 'feega must never be used to create non-consensual intimate imagery (NCII), sexual deepfakes or any sexual content of real people. Sexual content involving minors is forbidden and reported to the authorities. Prompts and reference images are screened automatically, real or identifiable people are blocked in sensitive contexts, and AI outputs are labelled as AI-generated. Anyone can report content to <a href="mailto:support@feega.app">support@feega.app</a>: we remove it and suspend the accounts responsible. Read our <a href="/acceptable-use">Acceptable Use Policy</a>, <a href="/terms">Terms</a> and <a href="/ai-transparency">AI Transparency</a>.'
  },
  {
    q: 'How do credits and pricing work?',
    a: 'Plans include monthly credits (1 credit = $1) that you spend on generations; you can top up when you need more. See <a href="#pricing">pricing</a>.'
  },
  {
    q: 'Who is behind feega?',
    a: 'feega is built in Italy by Andrea Buttarelli. Company details are in our <a href="/legal-notice">Legal Notice</a>; you can reach us at <a href="mailto:hi@feega.app">hi@feega.app</a>.'
  }
] as const;

export const MOTION_EMBED_ID = 'c76b6d3b-8262-4b68-ad58-3cb51a6190a9';
