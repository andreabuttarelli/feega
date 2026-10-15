import { env } from '$env/dynamic/private';
import { kieChat, kieTextModel, kieTextUsd, type KieChatConfig } from './kie-chat';
import { TaskProviderName } from './generation/task-providers';
import type { AiCallLog } from './ai-log';

export const KIE_TEXT_LABEL = 'canvas.text';

export type KieTextScope = { orgId: string; projectId: string; userId: string; actorKind?: 'user' | 'agent'; actorId?: string; agentKey?: string | null };

export type KieTextDeps = { config: KieChatConfig | null; log: (entry: AiCallLog) => void; now?: () => number };

export async function runKieText(
  deps: KieTextDeps,
  request: { model: string; prompt: string; system?: string; scope: KieTextScope }
): Promise<{ text: string; costUsd: number }> {
  const model = kieTextModel(request.model);
  if (!model || !deps.config) {
    throw new Error('kie_not_configured');
  }
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const base = {
    label: KIE_TEXT_LABEL,
    provider: TaskProviderName.Kie,
    model: model.id,
    orgId: request.scope.orgId,
    projectId: request.scope.projectId,
    userId: request.scope.userId,
    actorKind: request.scope.actorKind ?? 'user',
    actorId: request.scope.actorId ?? request.scope.userId,
    agentKey: request.scope.agentKey ?? null
  } as const;

  try {
    const out = await kieChat(deps.config).run(model, { prompt: request.prompt, system: request.system });
    const costUsd = kieTextUsd(model, out);
    deps.log({ ...base, ms: now() - startedAt, ok: true, flatCostUsd: costUsd, inputTokens: out.inputTokens, outputTokens: out.outputTokens });
    return { text: out.text, costUsd };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'kie_failed';
    deps.log({ ...base, ms: now() - startedAt, ok: false, error: message });
    throw error;
  }
}

export function kieTextDeps(log: (entry: AiCallLog) => void): KieTextDeps {
  const apiKey = env.KIE_API_KEY?.trim();
  return { config: apiKey ? { apiKey, baseUrl: env.KIE_CHAT_BASE_URL?.trim() || undefined } : null, log };
}
