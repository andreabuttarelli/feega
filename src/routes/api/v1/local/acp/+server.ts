import { error } from '@sveltejs/kit';
import { localStore } from '$lib/server/local/local-mode';
import { feegaMcp } from '$lib/server/acp/agents';
import { agentCwd } from '$lib/server/acp/agent-cwd';
import { acpSessions, type AgentCommand } from '$lib/server/acp/client';
import { Refresh, detectCached } from '$lib/server/acp/detect';
import { awaitChoice, choose } from '$lib/server/acp/permissions';
import { AcpEventKind, encodeAcpEvent, type AcpEvent } from '$lib/acp/acp-events';
import type { RequestHandler } from './$types';

const NOT_FOUND = 404;
const BAD_REQUEST = 400;
const NO_CONTENT = 204;
const CONFLICT = 409;
const LOCAL_APP_URL = 'http://127.0.0.1:5173';
const SSE_HEADERS = { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' };

type Body = { thread?: unknown; agent?: unknown; prompt?: unknown; cancel?: unknown; permission?: { id?: unknown; optionId?: unknown } };

type Turn = { cwd: string; thread: string; agentId: string; agent: AgentCommand; choice: { model: string | null; effort: string | null }; prompt: string };

function answer(permission: NonNullable<Body['permission']>): Response {
  if (typeof permission.id !== 'string' || typeof permission.optionId !== 'string') {
    error(BAD_REQUEST, 'permission id and optionId are required');
  }

  if (!choose(permission.id, permission.optionId)) {
    error(NOT_FOUND, 'No agent is waiting for this permission');
  }

  return new Response(null, { status: NO_CONTENT });
}

function stop(thread: unknown): Response {
  if (typeof thread !== 'string' || !acpSessions.cancel(thread)) {
    error(NOT_FOUND, 'No agent turn is running in this thread');
  }

  return new Response(null, { status: NO_CONTENT });
}

function stream(turn: Turn, signal: AbortSignal): Response {
  const encoder = new TextEncoder();
  const gone = new AbortController();
  signal.addEventListener('abort', () => gone.abort(), { once: true });

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AcpEvent) => {
        if (!gone.signal.aborted) {
          controller.enqueue(encoder.encode(encodeAcpEvent(event)));
        }
      };

      const ask = (permission: { title: string; options: { optionId: string; name: string; kind: string }[] }, cancelled: AbortSignal) => {
        const id = crypto.randomUUID();
        send({ kind: AcpEventKind.Permission, id, ...permission });
        return awaitChoice(id, cancelled);
      };

      try {
        const done = await acpSessions.turn(
          { ...turn, mcpServers: [feegaMcp(process.cwd(), process.env.PUBLIC_APP_URL ?? LOCAL_APP_URL)] },
          { onStarting: () => send({ kind: AcpEventKind.Starting }), onUpdate: (update) => send({ kind: AcpEventKind.Update, update }), ask, signal: gone.signal }
        );
        send({ kind: AcpEventKind.Done, stopReason: done.stopReason });
      } catch (e) {
        send({ kind: AcpEventKind.Failed, message: (e as Error).message });
      }

      if (!gone.signal.aborted) {
        controller.close();
      }
    },
    cancel() {
      gone.abort();
    }
  });

  return new Response(body, { headers: SSE_HEADERS });
}

export const POST: RequestHandler = async ({ request }) => {
  const opened = localStore();
  if (opened === null) {
    error(NOT_FOUND, 'ACP agents run only in local mode');
  }

  const body = (await request.json()) as Body;
  if (body.permission) {
    return answer(body.permission);
  }

  if (body.cancel !== undefined) {
    return stop(body.cancel);
  }

  if (typeof body.thread !== 'string' || typeof body.agent !== 'string' || typeof body.prompt !== 'string') {
    error(BAD_REQUEST, 'thread, agent and prompt are required');
  }

  const detected = (await detectCached(Refresh.Cached)).find((d) => d.agent.id === body.agent);
  if (!detected) {
    error(BAD_REQUEST, 'Unknown agent');
  }

  if (!detected.command) {
    error(CONFLICT, `${detected.agent.name} is not installed here, or cannot run over ACP`);
  }

  return stream({ cwd: agentCwd(opened.path, opened.codes()), thread: body.thread, agentId: body.agent, agent: detected.command, choice: { model: opened.acpModel(body.agent), effort: opened.acpEffort(body.agent) }, prompt: body.prompt }, request.signal);
};
