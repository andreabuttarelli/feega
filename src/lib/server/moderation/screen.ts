import { judgeDecision, mentionsMinor, MINORS, MODERATION_CATEGORIES, type JevDecision, type JudgeVerdict } from './policy';

export type ModerationRecord = {
  stage: 'rules' | 'jev' | 'llm';
  verdict: 'clear' | 'escalate' | 'refuse';
  category: string | null;
  probabilities: Record<string, number>;
  reason: string | null;
};

export type ScreenPorts = {
  decide(state: string): Promise<JevDecision>;
  judge(state: string): Promise<JudgeVerdict>;
  record(entry: ModerationRecord): void;
};

export type ScreenRequest = { text: string; references: string[]; uncensored: boolean };

export type ScreenOutcome = { ok: true } | { ok: false; error: string };

const UNAVAILABLE = 'moderation_unavailable';

function stateOf(request: ScreenRequest): string {
  const references = request.references.length ? `\nReferences attached: ${request.references.join('; ')}` : '';
  const mode = request.uncensored ? 'Adult (uncensored) model, opted in by an adult account owner.' : 'General-audience model.';
  return `${mode}\nPrompt: ${request.text}${references}`;
}

function errorOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function escalate(ports: ScreenPorts, state: string): Promise<ScreenOutcome> {
  let verdict: JudgeVerdict;
  try {
    verdict = await ports.judge(state);
  } catch (error) {
    ports.record({ stage: 'llm', verdict: 'refuse', category: null, probabilities: {}, reason: errorOf(error) });
    return { ok: false, error: `${UNAVAILABLE}: the safety review could not run` };
  }

  ports.record({ stage: 'llm', verdict: verdict.allowed ? 'clear' : 'refuse', category: verdict.category, probabilities: {}, reason: verdict.reason });
  if (verdict.allowed) {
    return { ok: true };
  }
  const message = MODERATION_CATEGORIES[verdict.category]?.refusal || 'Refused by the safety review';
  return { ok: false, error: verdict.reason ? `${message} (${verdict.reason})` : message };
}

export async function screenGeneration(ports: ScreenPorts, request: ScreenRequest): Promise<ScreenOutcome> {
  const state = stateOf(request);

  if (request.uncensored && mentionsMinor(`${request.text} ${request.references.join(' ')}`)) {
    ports.record({ stage: 'rules', verdict: 'refuse', category: MINORS, probabilities: {}, reason: 'minor keyword' });
    return { ok: false, error: MODERATION_CATEGORIES[MINORS].refusal };
  }

  let decision: JevDecision;
  try {
    decision = await ports.decide(state);
  } catch (error) {
    ports.record({ stage: 'jev', verdict: 'refuse', category: null, probabilities: {}, reason: errorOf(error) });
    return { ok: false, error: `${UNAVAILABLE}: ${errorOf(error)}` };
  }

  const verdict = judgeDecision(decision);
  ports.record({
    stage: 'jev',
    verdict: verdict.kind,
    category: verdict.kind === 'refuse' ? verdict.category : decision.choice,
    probabilities: decision.probabilities,
    reason: verdict.kind === 'escalate' ? verdict.reason : null
  });

  if (verdict.kind === 'refuse') {
    return { ok: false, error: verdict.message };
  }
  if (verdict.kind === 'escalate') {
    return escalate(ports, state);
  }
  return { ok: true };
}
