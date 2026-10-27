import { error } from '@sveltejs/kit';
import { localStore } from '$lib/server/local/local-mode';

const LIVE_TABLES = new Set(['nodes', 'nodes_connections', 'canvases', 'canvas_comments']);
const HEARTBEAT_MS = 15_000;
const NOT_FOUND = 404;

export const GET = async () => {
  const local = localStore();
  if (!local) {
    error(NOT_FOUND);
  }

  const encoder = new TextEncoder();
  let stop = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      send(': open\n\n');
      const off = local.subscribe((change) => {
        if (LIVE_TABLES.has(change.table)) {
          send(`data: ${JSON.stringify(change)}\n\n`);
        }
      });
      const beat = setInterval(() => send(': beat\n\n'), HEARTBEAT_MS);
      stop = () => {
        off();
        clearInterval(beat);
      };
    },
    cancel: () => stop()
  });

  return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' } });
};
