import { createServer, type Server } from 'node:http';
import sharp from 'sharp';

export type MockImages = { url: string; renders: () => number; close: () => Promise<void> };

const SAFE_VERDICT = JSON.stringify({ allowed: true, category: 'none', requested: false, reason: '' });

const RENDER = { width: 768, height: 1024, background: '#c9a27e' };

export async function startMockImages(port: number): Promise<MockImages> {
  const png = (await sharp({ create: { width: RENDER.width, height: RENDER.height, channels: 3, background: RENDER.background } }).png().toBuffer()).toString('base64');
  let rendered = 0;

  const server: Server = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      const send = (status: number, payload: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      if (req.method === 'POST' && req.url?.endsWith('/images')) {
        rendered += 1;
        send(200, { data: [{ b64_json: png, media_type: 'image/png' }], usage: { cost: 0 } });
        return;
      }
      if (req.method === 'POST' && req.url?.endsWith('/chat/completions')) {
        send(200, { id: 'mock', object: 'chat.completion', created: 0, model: 'mock', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: SAFE_VERDICT } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost: 0 } });
        return;
      }
      if (req.method === 'POST' && req.url?.endsWith('/responses')) {
        send(200, { id: 'mock', object: 'response', created_at: 0, status: 'completed', model: 'mock', output: [{ type: 'message', id: 'mock-message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: SAFE_VERDICT, annotations: [] }] }], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2, cost: 0 } });
        return;
      }
      send(404, { error: { message: `mock images: ${req.method} ${req.url} not served` } });
    });
  });

  await new Promise<void>((resolve) => server.listen(port, resolve));
  return {
    url: `http://localhost:${port}`,
    renders: () => rendered,
    close: () => new Promise((resolve) => server.close(() => resolve()))
  };
}
