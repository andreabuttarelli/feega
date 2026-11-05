const VIDEO_BASE = 'https://klnswzhhgrqvbfjzioul.supabase.co/storage/v1/object/public/website';

export const CANVAS_VIDEO = `${VIDEO_BASE}/feega-canvas-hero.MP4`;
export const CODE_VIDEO = `${VIDEO_BASE}/2026-10-29-export-code-final.mp4`;

export const AGENT_LOGOS = [
  { file: 'mcp-0.svg', width: 32, name: 'Claude Code' },
  { file: 'mcp-1.svg', width: 33, name: 'Codex' },
  { file: 'mcp-2.svg', width: 28, name: 'Cursor' }
] as const;

export const TICKER_VIDEOS = [
  'liquid-glass-1x1.MP4',
  'masking-loop-v3.MP4',
  'feega-showcase-v2.mp4',
  'demo-v2.MP4',
  'ui-morph-v2.mp4',
  'launch.MP4',
  '2-dark-pill-chips.mp4',
  'ui-ring-farm.MP4',
  'sting-loop-1x1.mp4',
  'scroll-story-default.mp4',
  'poster-liquid-glass-4x5.MP4',
  'draft-wide.mp4',
  'phone-chat-1x1-720.MP4',
  'split-headline-16x9.mp4',
  'preview-wide.mp4',
  'feature-scroll-dark-centred-16x9.mp4',
  'melting-type-poster-4x5.MP4',
  'floating-media-default.mp4',
  'ring-through-title-16x9.MP4',
  'media-cloud-white-16x9-720p.MP4'
].map((file) => `${VIDEO_BASE}/${file}`);

export const LOCAL_FEATURES = [
  'Design + Motion, infinite canvas',
  'Text, image, video, audio, 3D generations',
  'Bring your own keys for AI generations',
  'Unlimited canvases & projects',
  'Design & Motion templates library',
  'Copy & paste from Figma',
  'Coder mode for code export',
  'Embed mode for interactive scenes'
] as const;

export const CLOUD_FEATURES = [
  'All models from OpenRouter, Kie, Higgsfield, Wiro, Elevenlabs',
  'Unlimited canvases & projects',
  'AI assistant in-editor',
  'Use with your agents via MCP',
  'Unlimited team members',
  'Real-time collaboration',
  'Brand & products import',
  'Social accounts & posts import',
  'AI influencers',
  'Embed mode for interactive scenes'
] as const;

export const CLOUD_PRICE = 18;

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
    q: "What is Feega?",
    a: "Feega is one infinite canvas for design, motion and AI generation. It is open source: use it in the browser, or run it locally with npx feega. Google Sign-In is used only for authentication; no Google API is used to generate or edit content."
  },
  {
    q: "Is Feega open source?",
    a: "Yes. Feega is open source under the Apache-2.0 license. The code is on <a href=\"https://github.com/andreabuttarelli/feega\">GitHub</a>."
  },
  {
    q: "Can I run it locally?",
    a: "Yes. Run npx feega: no account, no cloud. Your work is saved in one .feega file on your machine. You need Node 22."
  },
  {
    q: "How does the canvas work?",
    a: "Design in frames with layers and components, animate them on a motion timeline, and add AI nodes for text, images, video, 3D and audio. Wire nodes together so one output feeds the next, then run them to generate."
  },
  {
    q: "Which AI models can I use?",
    a: "Images: Nano Banana (Google), GPT Image (OpenAI), Seedream (ByteDance) and Qwen. Video: Seedance (ByteDance), Kling and Grok Imagine (xAI). 3D: Trellis (Microsoft) and Hunyuan3D (Tencent). Voice, sound and music: ElevenLabs. You pick the model for each node."
  },
  {
    q: "Can I use my own AI keys?",
    a: "Yes, in local mode. Add your keys for OpenRouter, Kie.ai, Higgsfield, Wiro, ElevenLabs and a text LLM provider, and generate from text with them. No plan or credits needed."
  },
  {
    q: "What file formats can I import and export?",
    a: "Import images, video, SVG and Lottie files, paste from Figma, or open a .feega file. Export stills as PNG, JPG, WebP, SVG or PDF, and motion as MP4, GIF, APNG or Lottie."
  },
  {
    q: "Can I bring my Figma designs?",
    a: "Yes. Paste from Figma and your layers stay editable on the canvas."
  },
  {
    q: "Can I collaborate with my team in real time?",
    a: "Yes. Invite teammates to your workspace as members or admins: everyone works on the same canvas and sees changes and who is online live."
  },
  {
    q: "Can AI agents use Feega?",
    a: "Yes. Agents like Claude or Codex can work on your canvas through our MCP server and REST API, acting on your behalf with your permissions."
  },
  {
    q: "Are generated files marked as AI-generated?",
    a: "Yes. Every image and video Feega renders carries a machine-readable AI-generated marker in the file, and when we publish for you we set the platform\u2019s AI-content label where one exists. See <a href=\"/ai-transparency\">AI Transparency</a>."
  },
  {
    q: "Who owns what I create?",
    a: "You keep ownership of the content you bring, and you may use what you generate for your own business purposes, subject to our <a href=\"/terms\">Terms</a> and third-party rights."
  },
  {
    q: "Is my content used to train AI?",
    a: "No. We do not use your prompts, uploads or generated content to train AI models. See our <a href=\"/privacy\">Privacy Policy</a>."
  },
  {
    q: "How is content kept safe?",
    a: "Feega must never be used to create non-consensual intimate imagery (NCII), sexual deepfakes or any sexual content of real people. Sexual content involving minors is forbidden and reported to the authorities. Prompts and reference images are screened automatically, real or identifiable people are blocked in sensitive contexts, and AI outputs are labelled as AI-generated. Anyone can report content to <a href=\"mailto:support@feega.app\">support@feega.app</a>: we remove it and suspend the accounts responsible. Read our <a href=\"/acceptable-use\">Acceptable Use Policy</a>, <a href=\"/terms\">Terms</a> and <a href=\"/ai-transparency\">AI Transparency</a>."
  },
  {
    q: "How do credits and pricing work?",
    a: "In the cloud, AI runs are paid in credits. Every \u20ac1 of your plan gives 100 credits (\u20ac8/mo = 800 credits). A run costs 120 credits for every $1 the AI provider charges. Running locally with your own keys needs no credits. See <a href=\"#pricing\">pricing</a>."
  },
  {
    q: "Who is behind Feega?",
    a: "Feega is built in Italy by Andrea Buttarelli, a freelance designer who wanted a faster way to work. No VC money, no growth team: just a designer building the tool he needed, in the open. Company details are in the <a href=\"/legal-notice\">Legal Notice</a>, or write to <a href=\"mailto:hi@feega.app\">hi@feega.app</a>."
  }
] as const;
