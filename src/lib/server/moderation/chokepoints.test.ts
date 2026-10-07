import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const MODEL_ADAPTERS: readonly string[] = [
  'src/lib/server/llm',
  'src/lib/server/ai-text',
  'src/lib/server/research',
  'src/lib/server/media-generate',
  'src/lib/server/prompt-enhance',
  'src/lib/server/openrouter-image',
  'src/lib/server/openrouter-video',
  'src/lib/server/video',
  'src/lib/server/elevenlabs-config',
  'src/lib/server/wiro-config'
];

const MODEL_CALLS_FROM_AI_SDK = /\b(streamText|generateText|generateObject|streamObject)\b/;
const SOURCE = /\.(ts|svelte)$/;
const TEST = /\.(test|spec)\.ts$/;
const SPECIFIER = /(?:^|\n)\s*import\s+(?!type\b)([^;]*?)\s+from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sources(path);
    }
    return SOURCE.test(entry.name) && !TEST.test(entry.name) ? [path] : [];
  });
}

function resolved(file: string, specifier: string): string {
  if (specifier.startsWith('$lib/')) {
    return normalize(`src/lib/${specifier.slice('$lib/'.length)}`);
  }
  if (specifier.startsWith('.')) {
    return normalize(join(dirname(file), specifier));
  }
  return specifier;
}

function callsModel(file: string, source: string): boolean {
  for (const match of source.matchAll(SPECIFIER)) {
    const [, names, fromStatic, fromDynamic] = match;
    const specifier = fromStatic ?? fromDynamic;
    if (specifier === 'ai' && MODEL_CALLS_FROM_AI_SDK.test(names ?? '')) {
      return true;
    }
    if (MODEL_ADAPTERS.includes(resolved(file, specifier).replace(/\.ts$/, ''))) {
      return true;
    }
  }
  return false;
}

const ROOT = process.cwd();

function modelCallers(): string[] {
  return sources(join(ROOT, 'src'))
    .map((path) => relative(ROOT, path))
    .filter((file) => !MODEL_ADAPTERS.includes(file.replace(/\.ts$/, '')))
    .filter((file) => callsModel(file, readFileSync(join(ROOT, file), 'utf8')))
    .sort();
}

const SCREENED = 'screens user text with screenModelInput before the model call';

const MODEL_CALLERS: Readonly<Record<string, string>> = {
  'src/lib/server/canvas/generate.ts': SCREENED,
  'src/lib/server/influencer-create.ts': SCREENED,
  'src/routes/api/v1/prompts/enhance/+server.ts': SCREENED,
  'src/routes/api/v1/brands/[slug]/prompts/enhance/+server.ts': SCREENED,
  'src/routes/api/v1/projects/[projectId]/agent/+server.ts': SCREENED,
  'src/lib/server/motion/turn.ts': SCREENED,
  'src/lib/server/motion/voiceover.ts': SCREENED,
  'src/lib/server/motion/deep/agent.ts': 'the brief is screened by startDeep before the job exists; the critic frames come from the doc the builder made',
  'src/lib/server/moderation/moderation-config.ts': 'the moderator itself: Jev and the LLM judge',
  'src/lib/server/provider-purgers.ts': 'deletes stored provider copies, sends no prompt',
  'src/lib/server/brand-analysis.ts': 'brand wizard: reads a third-party website, the user types only its URL',
  'src/lib/server/brand-context.ts': 'brand research over site, catalogue and competitor material',
  'src/lib/server/brand-media.ts': 'brand research over site, catalogue and competitor material',
  'src/lib/server/brand-memory.ts': 'classifies knowledge already stored, no prompt typed for a model',
  'src/lib/server/design-typography.ts': 'brand research over site, catalogue and competitor material',
  'src/lib/server/market-references.ts': 'brand research over site, catalogue and competitor material',
  'src/lib/server/knowledge.ts': 'converts uploaded files to markdown and embeds them: no generation',
  'src/lib/server/media-generate.images.ts': 'inside media-generate: reached only after its caller screened the prompt',
  'src/lib/server/image-constraint-review.ts': 'inside media-generate: reviews a render whose prompt was screened',
  'src/lib/server/video-render-queue.ts': 'submits a render whose prompt runGenNode already screened',
  'src/lib/server/captions.ts': 'transcribes the audio of a rendered video',
  'src/lib/server/craft-model.ts': 'model resolver for prompt-enhance, screened at its callers',
  'src/lib/server/photo-craft-review.ts': 'unused by the canvas product',
  'src/lib/server/clip-craft-review.ts': 'unused by the canvas product',
  'src/lib/server/rubrics.ts': 'unused by the canvas product',
  'src/lib/server/chat-models.ts': 'reads the model catalogue, calls no model',
  'src/lib/server/media-model-prefs.ts': 'reads video durations, calls no model',
  'src/lib/server/offerable-models.ts': 'reads video durations, calls no model',
  'src/lib/server/studio-actions.ts': 'reads video durations, calls no model',
  'src/routes/p/[projectId]/settings/video/+page.server.ts': 'reads video durations, calls no model',
  'src/lib/server/canvas/audio-description.ts': 'lists ElevenLabs voices',
  'src/routes/api/v1/org/audio/voices/+server.ts': 'lists ElevenLabs voices',
  'src/routes/p/[projectId]/c/[canvasId]/+page.server.ts': 'lists ElevenLabs voices; generation goes through runGenNode'
};

describe('every path to a model provider goes through the moderation chokepoint', () => {
  const callers = modelCallers();

  it('a new caller of a model adapter must screen its text or say why it has none', () => {
    expect(callers.filter((file) => !MODEL_CALLERS[file])).toEqual([]);
  });

  it('the table has no rows for files that no longer call a model', () => {
    expect(Object.keys(MODEL_CALLERS).filter((file) => !callers.includes(file))).toEqual([]);
  });

  it('a caller declared as screened really calls screenModelInput', () => {
    const unscreened = Object.entries(MODEL_CALLERS)
      .filter(([, why]) => why === SCREENED)
      .map(([file]) => file)
      .filter((file) => !readFileSync(join(ROOT, file), 'utf8').includes('screenModelInput('));
    expect(unscreened).toEqual([]);
  });
});
