const VIDEO_BASE = 'https://klnswzhhgrqvbfjzioul.supabase.co/storage/v1/object/public/website';

export const COLLAGE_STAGE = { width: 1440, height: 900 } as const;

type Placement = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

export type CollageTile = Placement &
  ({ readonly kind: 'image'; readonly file: string } | { readonly kind: 'video'; readonly file: string });

const image = (file: string, x: number, y: number, w: number, h: number): CollageTile => ({ kind: 'image', file, x, y, w, h });
const video = (file: string, x: number, y: number, w: number, h: number): CollageTile => ({ kind: 'video', file: `${VIDEO_BASE}/${file}`, x, y, w, h });

export const COLLAGE: readonly CollageTile[] = [
  image('c-e', 588, 132, 175, 233),
  video('ui-ring-farm.MP4', 773, 132, 140, 79),
  image('c-d', 786, 232, 276, 276),
  image('c-h', 860, 430, 298, 298),
  image('c-a', 237, 233, 330, 400),
  video('ring-through-title-16x9.MP4', 318, 170, 256, 144),
  image('c-c', 108, 447, 260, 314),
  image('c-b', 276, 590, 298, 275),
  image('c-g', 616, 762, 210, 113),
  image('c-i', 513, 181, 413, 581),
  video('media-cloud-white-16x9-720p.MP4', 314, 519, 299, 168),
  video('ui-morph-v2.mp4', 1005, 275, 286, 286)
];

export const IMAGINE = ['Photography', 'UGC Videos', 'Fashion Shoots', '3D Models', 'Brand Identity', 'Art Direction', 'Video Trailers', 'Remix Ads'] as const;

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
    a: 'feega is an open-source infinite canvas where people and AI agents design, animate and generate together. Frames, motion, images, video, audio and text live as connected nodes on one canvas. Google Sign-In is used only for authentication; no Google API is used to generate or edit content.'
  },
  {
    q: 'Is feega open source?',
    a: 'Yes. feega is licensed under Apache-2.0 and the full source is on <a href="https://github.com/andreabuttarelli/feega">GitHub</a>, including the app, the command-line tool and the MCP server.'
  },
  {
    q: 'Can I run feega locally or offline?',
    a: 'Yes. Clone the repository, run npm install and then npm run local -- my-canvas.feega. The canvas runs on your machine with no account, database or Docker, and is saved in one .feega file. AI generation, sharing and comments need the cloud app.'
  },
  {
    q: 'How do I use feega with my AI agent?',
    a: 'Tell Claude Code or Codex to clone the repository and start it locally: the CLI and MCP server find the local canvas automatically and every edit shows live in your browser. For the cloud app, connect the MCP server at https://mcp.feega.app/mcp.'
  },
  {
    q: 'How much does feega cost?',
    a: 'Running feega locally is free. The cloud app has monthly plans from 8 to 256 credits, where 1 credit = $1 of generations; you can top up when you need more. See <a href="#pricing">pricing</a>.'
  },
  {
    q: 'How is feega different from Figma, Jitter and Flora?',
    a: 'Figma is a design tool, Jitter is a motion design tool and Flora is an AI generation canvas. feega puts design frames, a keyframe timeline and AI image, video and audio generation on one canvas, is open source, and can be driven by an AI agent through its CLI and MCP server.'
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
    q: 'Who is behind feega?',
    a: 'feega is built in Italy by Andrea Buttarelli. Company details are in our <a href="/legal-notice">Legal Notice</a>; you can reach us at <a href="mailto:hi@feega.app">hi@feega.app</a>.'
  }
] as const;

export const LOCAL_COMMANDS = `git clone https://github.com/andreabuttarelli/feega && cd feega && npm install
npm run local -- my-canvas.feega`;

export const AGENT_PROMPT =
  'Use feega locally: clone https://github.com/andreabuttarelli/feega, run npm install, start it with npm run local -- my-canvas.feega, then use the feega CLI or MCP server on http://localhost:5173 to design on the canvas.';

export const MOTION_EMBED_ID = 'c76b6d3b-8262-4b68-ad58-3cb51a6190a9';
