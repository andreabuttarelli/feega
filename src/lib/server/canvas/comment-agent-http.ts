import type { AgentAnswer, AgentJob, CommentAgent } from './comment-agent';

type Link = { origin: string; token: string };

type Fetcher = typeof fetch;

type Message = { role: string; content: string };

const NO_ANSWER: AgentAnswer = { ok: false, message: 'no_answer' };

async function refusalOf(res: Response): Promise<AgentAnswer> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return { ok: false, message: body?.error ?? `status_${res.status}` };
}

export function httpAgent(link: Link, fetcher: Fetcher = fetch): CommentAgent {
  return async (job: AgentJob) => {
    const url = `${link.origin}/api/v1/projects/${job.projectId}/agent`;
    const headers = { authorization: `Bearer ${link.token}`, 'content-type': 'application/json' };

    const turn = await fetcher(url, { method: 'POST', headers, body: JSON.stringify({ message: job.prompt, canvasId: job.canvasId, selection: job.nodeIds }) });
    if (!turn.ok) {
      return refusalOf(turn);
    }
    await turn.text();

    const thread = await fetcher(url, { headers });
    const { messages = [] } = ((await thread.json().catch(() => null)) ?? {}) as { messages?: Message[] };
    const answer = [...messages].reverse().find((m) => m.role === 'assistant' && m.content.trim());

    return answer ? { ok: true, text: answer.content.trim() } : NO_ANSWER;
  };
}
