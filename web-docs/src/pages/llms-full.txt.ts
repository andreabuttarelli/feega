import { loadDocPages } from '../lib/docs-pages';
import { llmsFullTxt } from '../lib/llms.js';

export async function GET() {
  return new Response(llmsFullTxt(await loadDocPages()), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
