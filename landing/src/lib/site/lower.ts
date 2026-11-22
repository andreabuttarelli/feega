const PROPER_WORDS = new Set([
  'Feega', 'Claude', 'Codex', 'Cursor', 'Google', 'Figma', 'Stripe', 'React', 'Node', 'Italy', 'Andrea', 'Buttarelli',
  'Discord', 'Instagram', 'Mac', 'Apple', 'Lottie', 'Nano', 'Banana', 'GPT', 'OpenAI', 'Seedream', 'Qwen', 'Seedance',
  'Kling', 'Grok', 'Trellis', 'Microsoft', 'Tencent', 'Kie', 'Higgsfield', 'Wiro', 'Apache', 'Svelte', 'Vue', 'Nuxt',
  'Astro', 'Gatsby', 'Angular', 'Vite', 'Solid', 'Remix', 'Roma', 'Topaz', 'Canva', 'CapCut', 'Spotify', 'Blender',
  'Italian', 'Cloud', 'Next', 'Windows', 'Linux', 'Notion', 'Slack', 'Supabase', 'Windsurf', 'Tailwind', 'GitHub',
  'Lovable', 'Framer', 'Onlook', 'Stitch', 'Vercel', 'Firebase', 'Gemini', 'Copilot', 'Cline', 'Anthropic', 'SvelteKit'
]);

const PROTECTED_PHRASES = ['Feega Cloud', 'Claude Code', 'VS Code', 'Grok Build', 'Grok Imagine', 'GPT Image', 'Create React App', 'React Router'];

const MARKUP = /(<[^>]*>)/;
const WORD = /\b[A-Z][a-z]+\b/g;

const lowerSegment = (segment: string): string => {
  const kept: string[] = [];
  const masked = PROTECTED_PHRASES.reduce(
    (text, phrase) => text.split(phrase).join(`\u0000${kept.push(phrase) - 1}\u0000`),
    segment
  );
  const lowered = masked.replace(WORD, (word) => (PROPER_WORDS.has(word) ? word : word.toLowerCase())).replace(/\bI\b(?!['’]?[A-Z])/g, 'i');

  return lowered.replace(/\u0000(\d+)\u0000/g, (_, index) => kept[Number(index)]);
};

export const lower = (text: string): string =>
  text
    .split(MARKUP)
    .map((part) => (part.startsWith('<') ? part : lowerSegment(part)))
    .join('');
