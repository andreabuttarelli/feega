import { z } from 'zod';
import { ACTS, MAX_LINE_WORDS, type Act, scriptProblems, type LaunchScript, type Research } from '$lib/motion/script';

const LINES = z.object({ acts: z.array(z.object({ act: z.enum(ACTS), on_screen: z.array(z.string().trim().min(1)).min(1).max(4) })).length(ACTS.length) });

export const COPY_SCHEMA = z.toJSONSchema(LINES) as Record<string, unknown>;

export type CopyPorts = { ask: (prompt: string) => Promise<{ answer: unknown; usd: number }> };

const hostOf = (url: string) => url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

export function copyPrompt(script: LaunchScript, r: Research): string {
  const site = hostOf(r.promise.source.url);
  return [
    'You are the copywriter of a product launch trailer. Write the on-screen lines, act by act; each line is its own full-frame title card, read in order as one short story.',
    `Facts (use only these, never invent):`,
    `- For: ${r.audience}`,
    `- Problem: ${r.problem}`,
    `- Everyday struggle: ${r.struggle}`,
    `- What it does: ${r.flow.join(' → ')}`,
    ...r.benefits.map((b) => `- Benefit: ${b.claim}`),
    ...r.numbers.map((n) => `- Proof: ${n.value}`),
    `- Promise (the site's own words): ${r.promise.text}`,
    `- Address: ${site}`,
    `Acts: ${script.acts.map((a) => `${a.act} (${a.scene})`).join('; ')}.`,
    `Rules: each line is said once (never repeat the tagline in two acts), every line at most ${MAX_LINE_WORDS} words, plain words a customer would say, no buzzwords, no hype, no questions without answers. problem: name the pain concretely for that audience. solution: what you do with the product, as actions. proof: one number or result from the facts. claim: the promise one sentence per line (never split a sentence across lines), then the address ${site} as the last line. Write one language for every line: the language of the site's own copy (the promise above), never mixed; the promise stays verbatim in the site's words only when that is the same language, otherwise translate it. Read all the lines in order: they must make sense as one sentence of thought, each following from the one before.`
  ].join('\n');
}

const SENTENCE_END = /[.!?…]$/;
const CONTINUES = /^\p{Ll}/u;

function wholeSentences(lines: string[]): string[] {
  return lines.reduce<string[]>((cards, line) => {
    const last = cards.at(-1);
    if (last === undefined || SENTENCE_END.test(last) || !CONTINUES.test(line)) {
      return [...cards, line];
    }
    return [...cards.slice(0, -1), `${last} ${line}`];
  }, []);
}

export function applyCopy(script: LaunchScript, answer: unknown): LaunchScript {
  const parsed = LINES.safeParse(answer);
  if (!parsed.success) {
    return script;
  }
  const byAct = new Map<Act, string[]>(parsed.data.acts.map((a) => [a.act, wholeSentences(a.on_screen)]));
  const copied = { ...script, acts: script.acts.map((a) => ({ ...a, on_screen: byAct.get(a.act) ?? a.on_screen })) };
  return scriptProblems(copied).length ? script : copied;
}

export async function copywrite(ports: CopyPorts, script: LaunchScript): Promise<{ script: LaunchScript; usd: number }> {
  if (!script.research) {
    return { script, usd: 0 };
  }
  const asked = await ports.ask(copyPrompt(script, script.research)).catch(() => null);
  return asked ? { script: applyCopy(script, asked.answer), usd: asked.usd } : { script, usd: 0 };
}
