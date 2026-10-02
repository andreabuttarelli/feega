import {
  identifiabilityDecision,
  IDENTIFIABILITY_CATEGORIES,
  judgeDecision,
  mentionsMinor,
  MINORS,
  REAL_PERSON,
  MODERATION_CATEGORIES,
  type JevDecision,
  type JudgeVerdict
} from './policy';
import { JevOutage, MODERATION_PROFILES, carriedProfile, type ProfilePolicy } from './profiles';

export type ModerationRecord = {
  stage: 'rules' | 'jev' | 'llm' | 'identifiability';
  verdict: 'clear' | 'escalate' | 'refuse';
  category: string | null;
  probabilities: Record<string, number>;
  reason: string | null;
};

export type ScreenPorts = {
  decide(state: string): Promise<JevDecision>;
  judge(state: string): Promise<JudgeVerdict>;
  decideIdentifiability(state: string): Promise<JevDecision>;
  judgeIdentifiability(state: string): Promise<JudgeVerdict>;
  record(entry: ModerationRecord): void;
};

export type ScreenRequest = { text: string; references: string[]; uncensored: boolean; operation?: string };

export type ScreenOutcome = { ok: true } | { ok: false; error: string; unavailable?: true };

const UNAVAILABLE = 'moderation_unavailable';

type ScreenStage = 'content' | 'identifiability';

type StageRule = { applies: (request: ScreenRequest) => boolean; stages: readonly ScreenStage[]; skipped?: string };

const STAGE_RULES: readonly StageRule[] = [
  { applies: (r) => r.operation === 'model3d' && !r.text.trim(), stages: [], skipped: 'skipped: no text (model3d)' },
  { applies: (r) => r.uncensored, stages: ['content', 'identifiability'] },
  { applies: () => true, stages: ['content'] }
];

function ruleFor(request: ScreenRequest): StageRule {
  return STAGE_RULES.find((rule) => rule.applies(request))!;
}

function stateOf(request: ScreenRequest): string {
  const references = request.references.length ? `\nReferences attached: ${request.references.join('; ')}` : '';
  const mode = request.uncensored ? 'Adult (uncensored) model, opted in by an adult account owner.' : 'General-audience model.';
  return `${mode}\nPrompt: ${request.text}${references}`;
}

function errorOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function escalateContent(ports: ScreenPorts, state: string, policy: ProfilePolicy): Promise<ScreenOutcome> {
  let verdict: JudgeVerdict;
  try {
    verdict = await ports.judge(state);
  } catch (error) {
    ports.record({ stage: 'llm', verdict: 'refuse', category: null, probabilities: {}, reason: errorOf(error) });
    return { ok: false, error: `${UNAVAILABLE}: the safety review could not run`, unavailable: true };
  }

  ports.record({ stage: 'llm', verdict: verdict.allowed ? 'clear' : 'refuse', category: verdict.category, probabilities: {}, reason: verdict.reason });
  if (verdict.allowed) {
    return { ok: true };
  }
  const message = policy.categories[verdict.category]?.refusal || policy.judgeRefusal;
  return { ok: false, error: verdict.reason ? `${message} (${verdict.reason})` : message };
}

const ON_JEV_OUTAGE: Readonly<Record<JevOutage, (ports: ScreenPorts, state: string, policy: ProfilePolicy, error: unknown) => Promise<ScreenOutcome>>> = {
  [JevOutage.Judge]: (ports, state, policy) => escalateContent(ports, state, policy),
  [JevOutage.Refuse]: async (_ports, _state, _policy, error) => ({ ok: false, error: `${UNAVAILABLE}: ${errorOf(error)}`, unavailable: true })
};

const OUTAGE_VERDICT: Readonly<Record<JevOutage, ModerationRecord['verdict']>> = {
  [JevOutage.Judge]: 'escalate',
  [JevOutage.Refuse]: 'refuse'
};

async function screenContent(ports: ScreenPorts, state: string, policy: ProfilePolicy): Promise<ScreenOutcome> {
  let decision: JevDecision;
  try {
    decision = await ports.decide(state);
  } catch (error) {
    ports.record({ stage: 'jev', verdict: OUTAGE_VERDICT[policy.onJevOutage], category: null, probabilities: {}, reason: errorOf(error) });
    return ON_JEV_OUTAGE[policy.onJevOutage](ports, state, policy, error);
  }

  const verdict = judgeDecision(decision, policy.categories);
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
    return escalateContent(ports, state, policy);
  }
  return { ok: true };
}

async function escalateIdentifiability(ports: ScreenPorts, state: string): Promise<ScreenOutcome> {
  let verdict: JudgeVerdict;
  try {
    verdict = await ports.judgeIdentifiability(state);
  } catch (error) {
    ports.record({ stage: 'identifiability', verdict: 'refuse', category: null, probabilities: {}, reason: errorOf(error) });
    return { ok: false, error: `${UNAVAILABLE}: the identifiability review could not run` };
  }

  ports.record({ stage: 'identifiability', verdict: verdict.allowed ? 'clear' : 'refuse', category: verdict.category, probabilities: {}, reason: verdict.reason });
  if (verdict.allowed) {
    return { ok: true };
  }
  const message = IDENTIFIABILITY_CATEGORIES[verdict.category]?.refusal || 'Refused: too specific — could depict a real person.';
  return { ok: false, error: verdict.reason ? `${message} (${verdict.reason})` : message };
}

async function screenIdentifiability(ports: ScreenPorts, state: string): Promise<ScreenOutcome> {
  let decision: JevDecision;
  try {
    decision = await ports.decideIdentifiability(state);
  } catch (error) {
    ports.record({ stage: 'identifiability', verdict: 'refuse', category: null, probabilities: {}, reason: errorOf(error) });
    return { ok: false, error: `${UNAVAILABLE}: ${errorOf(error)}` };
  }

  const verdict = identifiabilityDecision(decision);
  ports.record({
    stage: 'identifiability',
    verdict: verdict.kind,
    category: verdict.kind === 'refuse' ? verdict.category : decision.choice,
    probabilities: decision.probabilities,
    reason: verdict.kind === 'escalate' ? verdict.reason : null
  });

  if (verdict.kind === 'refuse') {
    return { ok: false, error: verdict.message };
  }
  if (verdict.kind === 'escalate') {
    return escalateIdentifiability(ports, state);
  }
  return { ok: true };
}

const SCREEN_OF: Readonly<Record<ScreenStage, (ports: ScreenPorts, state: string, policy: ProfilePolicy) => Promise<ScreenOutcome>>> = {
  content: screenContent,
  identifiability: screenIdentifiability
};

const UNCENSORED_RULES: ReadonlyArray<readonly [string, (request: ScreenRequest) => boolean, string]> = [
  [MINORS, (r) => mentionsMinor(`${r.text} ${r.references.join(' ')}`), 'minor keyword'],
  [REAL_PERSON, (r) => r.references.length > 0, 'reference attached']
];

export async function screenGeneration(ports: ScreenPorts, request: ScreenRequest): Promise<ScreenOutcome> {
  const state = stateOf(request);
  const policy = MODERATION_PROFILES[carriedProfile(request)];

  const rule = UNCENSORED_RULES.find(([, applies]) => request.uncensored && applies(request));
  if (rule) {
    const [category, , reason] = rule;
    ports.record({ stage: 'rules', verdict: 'refuse', category, probabilities: {}, reason });
    return { ok: false, error: MODERATION_CATEGORIES[category].refusal };
  }

  const rule = ruleFor(request);
  if (rule.skipped) {
    ports.record({ stage: 'rules', verdict: 'clear', category: null, probabilities: {}, reason: rule.skipped });
  }

  const outcomes = await Promise.all(rule.stages.map((stage) => SCREEN_OF[stage](ports, state, policy)));
  return outcomes.find((outcome) => !outcome.ok) ?? { ok: true };
}
