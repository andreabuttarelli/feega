import { loadDocPages } from '../lib/docs-pages';
import { llmsTxt } from '../lib/llms.js';

export async function GET() {
  return new Response(llmsTxt(await loadDocPages()), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
