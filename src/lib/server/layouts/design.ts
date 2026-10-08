import { z } from 'zod';
import type { Db } from '$lib/server/db/client';
import { llmStructured } from '$lib/server/llm';
import { withOrgContext } from '$lib/server/ai-log';
import { screenModelInput } from '$lib/server/moderation/model-input';
import { ModerationProfile } from '$lib/server/moderation/profiles';
import { Outcome } from '$lib/server/repos/effects';
import { writeLayout, type LayoutWritten } from '$lib/server/repos/layouts';

export const COMPOSE_AGENT_KEY = 'compose';
const TRIES = 2;

export const LAYOUT_SPEC_GUIDE = [
  'A composition layout places media cards in 3D and moves them in a loop. Answer { name, spec }.',
  'name: kebab-case. spec: { kind: "spec", cards: "1:1"|"4:5"|"9:16"|"16:9"|"3:4"|"original", camera: "fixed"|"selected", motion: "cycle"|"ping-pong"|"linear",',
  'slots: how many cards (≤ 200), params: [{ name, label, kind: "range", min, max, step, default }],',
  'place: one of { kind: "grid", columns, gapX, gapY } | { kind: "ring", radius } | { kind: "line", gap, axis: "x"|"y"|"z" } | { kind: "scatter", spread, depth, seed },',
  'tilt: { x, y, z } radians, scale: card scale (1 ≈ one unit wide; gaps ≈ 2 between cards),',
  'animate: [{ prop: x|y|z|rotX|rotY|rotZ|scale|opacity, fn: sin|linear|ease, amp, freq (cycles per loop), phase: { column, row, index } }] (≤ 12).',
  'Any number may be { "param": name } of a declared param. t runs 0..1 over the loop.'
].join(' ');

const ANSWER_SCHEMA = z.toJSONSchema(z.object({ name: z.string(), spec: z.record(z.string(), z.unknown()) }));

export type LayoutAsk = (prompt: string) => Promise<{ name: string; spec: unknown }>;

const askModel: LayoutAsk = (prompt) => llmStructured({ prompt, system: LAYOUT_SPEC_GUIDE, schema: ANSWER_SCHEMA as Record<string, unknown>, label: 'compose-layout' });

export async function designLayout(db: Db, scope: { orgId: string; userId: string }, prompt: string, ask: LayoutAsk = askModel): Promise<LayoutWritten> {
  const screened = await screenModelInput(db, { profile: ModerationProfile.Standard, texts: [prompt], scope: { orgId: scope.orgId, userId: scope.userId } });
  if (!screened.ok) {
    return { outcome: Outcome.Invalid, problems: [screened.error] };
  }

  const actor = { kind: 'agent' as const, id: scope.userId, agentKey: COMPOSE_AGENT_KEY };
  let request = `Design this layout: ${prompt}`;
  let written: LayoutWritten = { outcome: Outcome.Invalid, problems: [] };
  for (let i = 0; i < TRIES; i++) {
    const answer = await withOrgContext(scope.orgId, () => ask(request));
    written = await writeLayout(db, scope.orgId, actor, answer);
    if (written.outcome !== Outcome.Invalid) {
      return written;
    }

    request = `Design this layout: ${prompt}\nYour last spec was refused: ${(written.problems ?? []).join('; ')}. Fix it.`;
  }

  return written;
}
