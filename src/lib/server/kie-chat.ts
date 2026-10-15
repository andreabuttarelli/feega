import { idPrefixOf, TaskProviderName } from './generation/task-providers';

export const DEFAULT_KIE_CHAT_BASE_URL = 'https://api.kie.ai';

const RESPONSES_PATH = '/codex/v1/responses';
const TOKENS_PER_MILLION = 1_000_000;

export type KieTextModel = { id: string; kieModel: string; label: string; usdPerMillionIn: number; usdPerMillionOut: number };

export const KIE_TEXT_MODELS: readonly KieTextModel[] = [
  { id: `${idPrefixOf(TaskProviderName.Kie)}gpt-6-luna`, kieModel: 'gpt-6-luna', label: 'GPT 6 Luna', usdPerMillionIn: 0.03, usdPerMillionOut: 0.15 }
];

export function kieTextModel(id: string | null | undefined): KieTextModel | undefined {
  return KIE_TEXT_MODELS.find((model) => model.id === id);
}

export type KieTextUsage = { inputTokens: number; outputTokens: number };

export function kieTextUsd(model: KieTextModel, usage: KieTextUsage): number {
  return (usage.inputTokens * model.usdPerMillionIn + usage.outputTokens * model.usdPerMillionOut) / TOKENS_PER_MILLION;
}

type ResponsesReply = {
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  msg?: string;
  error?: { message?: string };
};

function textOf(reply: ResponsesReply): string {
  return (reply.output ?? [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text ?? '')
    .join('');
}

export type KieChatConfig = { apiKey: string; baseUrl?: string; fetchFn?: typeof fetch };

export function kieChat(config: KieChatConfig) {
  const baseUrl = (config.baseUrl ?? DEFAULT_KIE_CHAT_BASE_URL).replace(/\/$/, '');
  const doFetch = config.fetchFn ?? fetch;

  return {
    async run(model: KieTextModel, request: { system?: string; prompt: string }): Promise<{ text: string } & KieTextUsage> {
      const body = { model: model.kieModel, stream: false, ...(request.system ? { instructions: request.system } : {}), input: request.prompt };
      const res = await doFetch(`${baseUrl}${RESPONSES_PATH}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const reply = (await res.json().catch(() => ({}))) as ResponsesReply;
      if (!res.ok) {
        throw new Error(`kie_failed: HTTP ${res.status} ${reply.msg ?? reply.error?.message ?? ''}`.trim());
      }
      return { text: textOf(reply), inputTokens: reply.usage?.input_tokens ?? 0, outputTokens: reply.usage?.output_tokens ?? 0 };
    }
  };
}
