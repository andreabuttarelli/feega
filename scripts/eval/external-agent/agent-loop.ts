import { AGENT_MODEL, MAX_OUTPUT_TOKENS, MAX_TURNS, OPENROUTER_URL, TOOL_RESULT_MAX_CHARS } from './config';

export type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> };

export type Image = { mime: string; data: string };

export type ToolOutput = { text: string; images: Image[] };

export type Tools = { specs: ToolSpec[]; call: (name: string, args: Record<string, unknown>) => Promise<ToolOutput> };

export type Usage = { promptTokens: number; completionTokens: number; cachedTokens: number; costUsd: number };

export enum Stop {
  Done = 'done',
  TurnLimit = 'turn_limit',
  CostCap = 'cost_cap',
  Error = 'error'
}

export type RunStats = {
  stop: Stop;
  turns: number;
  toolCalls: number;
  toolCallsByName: Record<string, number>;
  toolErrors: number;
  usage: Usage;
  finalText: string;
  error: string | null;
  transcript: Message[];
};

type ToolCall = { id: string; function: { name: string; arguments: string } };

export type Message = Record<string, unknown>;

export type ChatReply = {
  message: { content: string | null; tool_calls?: ToolCall[] };
  usage: { prompt_tokens: number; completion_tokens: number; cost?: number; prompt_tokens_details?: { cached_tokens?: number } };
};

export type Chat = (messages: Message[], tools: unknown[]) => Promise<ChatReply>;

export type LoopInput = { system: string; task: string; tools: Tools; capUsd: number; chat?: Chat; maxTurns?: number };

const NO_USAGE: Usage = { promptTokens: 0, completionTokens: 0, cachedTokens: 0, costUsd: 0 };

export function openRouterChat(model: string = AGENT_MODEL): Chat {
  return async (messages, tools) => {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, tools, max_tokens: MAX_OUTPUT_TOKENS, usage: { include: true } })
    });
    const body = (await response.json()) as ChatReply & { choices?: { message: ChatReply['message'] }[]; error?: { message: string } };
    if (!response.ok || !body.choices?.[0]) {
      throw new Error(`openrouter ${response.status}: ${body.error?.message ?? JSON.stringify(body).slice(0, 300)}`);
    }
    return { message: body.choices[0].message, usage: body.usage };
  };
}

function toApiTools(specs: ToolSpec[]): unknown[] {
  return specs.map((s) => ({ type: 'function', function: { name: s.name, description: s.description, parameters: s.parameters } }));
}

function clip(text: string): string {
  return text.length <= TOOL_RESULT_MAX_CHARS ? text : `${text.slice(0, TOOL_RESULT_MAX_CHARS)}\n[truncated ${text.length - TOOL_RESULT_MAX_CHARS} chars]`;
}

function add(total: Usage, reply: ChatReply['usage']): Usage {
  return {
    promptTokens: total.promptTokens + reply.prompt_tokens,
    completionTokens: total.completionTokens + reply.completion_tokens,
    cachedTokens: total.cachedTokens + (reply.prompt_tokens_details?.cached_tokens ?? 0),
    costUsd: total.costUsd + (reply.cost ?? 0)
  };
}

function parseArguments(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function imageMessage(images: Image[]): Message {
  return {
    role: 'user',
    content: [{ type: 'text', text: 'Image result of the last tool call.' }, ...images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.data}` } }))]
  };
}

export async function runAgent(input: LoopInput): Promise<RunStats> {
  const chat = input.chat ?? openRouterChat();
  const limit = input.maxTurns ?? MAX_TURNS;
  const messages: Message[] = [
    { role: 'system', content: [{ type: 'text', text: input.system, cache_control: { type: 'ephemeral' } }] },
    { role: 'user', content: input.task }
  ];
  const stats: RunStats = { stop: Stop.Done, turns: 0, toolCalls: 0, toolCallsByName: {}, toolErrors: 0, usage: NO_USAGE, finalText: '', error: null, transcript: messages };

  while (true) {
    if (stats.turns >= limit) {
      return { ...stats, stop: Stop.TurnLimit };
    }
    if (stats.usage.costUsd >= input.capUsd) {
      return { ...stats, stop: Stop.CostCap };
    }

    let reply: ChatReply;
    try {
      reply = await chat(messages, toApiTools(input.tools.specs));
    } catch (e) {
      return { ...stats, stop: Stop.Error, error: e instanceof Error ? e.message : String(e) };
    }
    stats.turns += 1;
    stats.usage = add(stats.usage, reply.usage);

    const calls = reply.message.tool_calls ?? [];
    messages.push({ role: 'assistant', content: reply.message.content ?? '', ...(calls.length ? { tool_calls: calls } : {}) });
    if (calls.length === 0) {
      return { ...stats, finalText: reply.message.content ?? '' };
    }

    const seen: Image[] = [];
    for (const call of calls) {
      stats.toolCalls += 1;
      stats.toolCallsByName[call.function.name] = (stats.toolCallsByName[call.function.name] ?? 0) + 1;
      const args = parseArguments(call.function.arguments);
      const out = args ? await input.tools.call(call.function.name, args).catch((e) => ({ text: `error: ${e instanceof Error ? e.message : String(e)}`, images: [] })) : { text: 'error: arguments are not a JSON object', images: [] };
      if (out.text.startsWith('error')) {
        stats.toolErrors += 1;
      }
      seen.push(...out.images);
      messages.push({ role: 'tool', tool_call_id: call.id, content: clip(out.text) });
    }
    if (seen.length > 0) {
      messages.push(imageMessage(seen));
    }
  }
}
