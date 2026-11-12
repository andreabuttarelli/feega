import { error } from '@sveltejs/kit';
import { localStore } from '$lib/server/local/local-mode';
import { ACP_AGENTS, feegaMcp, isAcpAgent } from '$lib/server/acp/agents';
import { runAcpTurn } from '$lib/server/acp/client';
import { awaitChoice, choose } from '$lib/server/acp/permissions';
import { AcpEventKind, encodeAcpEvent, type AcpEvent } from '$lib/acp/acp-events';
import type { RequestHandler } from './$types';

const NOT_FOUND = 404;
const BAD_REQUEST = 400;
const NO_CONTENT = 204;
const LOCAL_APP_URL = 'http://127.0.0.1:5173';
const SSE_HEADERS = { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' };

type Body = { agent?: unknown; prompt?: unknown; permission?: { id?: unknown; optionId?: unknown } };

function answer(permission: NonNullable<Body['permission']>): Response {
  if (typeof permission.id !== 'string' || typeof permission.optionId !== 'string') {
    error(BAD_REQUEST, 'permission id and optionId are required');
  }

  if (!choose(permission.id, permission.optionId)) {
    error(NOT_FOUND, 'No agent is waiting for this permission');
  }

  return new Response(null, { status: NO_CONTENT });
}

function stream(agent: keyof typeof ACP_AGENTS, prompt: string, signal: AbortSignal): Response {
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AcpEvent) => controller.enqueue(new TextEncoder().encode(encodeAcpEvent(event)));

      const ask = (permission: { title: string; options: { optionId: string; name: string; kind: string }[] }) => {
        const id = crypto.randomUUID();
        send({ kind: AcpEventKind.Permission, id, ...permission });
        return awaitChoice(id, signal);
      };

      try {
        const turn = await runAcpTurn(
          { agent: ACP_AGENTS[agent], cwd: process.cwd(), mcpServers: [feegaMcp(process.cwd(), process.env.PUBLIC_APP_URL ?? LOCAL_APP_URL)], prompt },
          { onUpdate: (update) => send({ kind: AcpEventKind.Update, update }), ask, signal }
        );
        send({ kind: AcpEventKind.Done, stopReason: turn.stopReason });
      } catch (e) {
        send({ kind: AcpEventKind.Failed, message: (e as Error).message });
      }

      controller.close();
    }
  });

  return new Response(body, { headers: SSE_HEADERS });
}

export const POST: RequestHandler = async ({ request }) => {
  if (localStore() === null) {
    error(NOT_FOUND, 'ACP agents run only in local mode');
  }

  const body = (await request.json()) as Body;
  if (body.permission) {
    return answer(body.permission);
  }

  if (!isAcpAgent(body.agent) || typeof body.prompt !== 'string') {
    error(BAD_REQUEST, 'agent and prompt are required');
  }

  return stream(body.agent, body.prompt, request.signal);
};
