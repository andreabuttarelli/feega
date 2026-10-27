import { readFileSync } from 'node:fs';
import { loadSession } from '../lib/auth.ts';
import { studioApi, type BatchAction } from '../lib/studio.ts';

async function token(): Promise<string> {
  const session = await loadSession();
  if (!session) {
    console.error('Session expired or missing. Run: feega login');
    process.exit(1);
  }
  return session.access_token;
}

const selectionOf = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

export async function cmdStudioQuote(opts: { file: string; project?: string }) {
  const quote = await studioApi.quote(await token(), selectionOf(opts.file), opts.project);
  console.log(`${quote.count} images, ${quote.total} credits (${quote.perImage} each)`);
  quote.skipped.forEach((line) => console.log(`skipped: ${line}`));
  console.log(`quote id: ${quote.quoteId}`);
}

export async function cmdStudioStart(opts: { file: string; quote: string; project?: string }) {
  const { batchId } = await studioApi.start(await token(), selectionOf(opts.file), opts.quote, opts.project);
  console.log(`started ${batchId}`);
}

export async function cmdStudioStatus(batchId: string) {
  console.log(JSON.stringify(await studioApi.status(await token(), batchId), null, 2));
}

export async function cmdStudioAct(action: BatchAction, batchId: string, opts: { items?: string[]; variations?: string }) {
  const body = { itemIds: opts.items, variations: opts.variations ? Number(opts.variations) : undefined };
  console.log(JSON.stringify(await studioApi.act(await token(), batchId, action, body)));
}
