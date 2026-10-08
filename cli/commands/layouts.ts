import { readFileSync } from 'node:fs';
import { loadSession } from '../lib/auth.ts';
import { layoutsApi, type StoredLayout } from '../lib/layouts.ts';

async function token(): Promise<string> {
  const session = await loadSession();
  if (!session) {
    console.error('Session expired or missing. Run: feega login');
    process.exit(1);
  }
  return session.access_token;
}

const print = (layout: StoredLayout) => console.log(`${layout.id}  ${layout.name}  v${layout.version}`);

const specOf = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

export async function cmdLayouts(opts: { org?: string }) {
  const { layouts } = await layoutsApi.list(await token(), opts.org);
  if (!layouts.length) {
    console.log('No custom layouts yet: feega layouts write <name> --file spec.json');
    return;
  }
  layouts.forEach(print);
}

export async function cmdLayoutsWrite(name: string, opts: { file: string; org?: string }) {
  print((await layoutsApi.write(await token(), { name, spec: specOf(opts.file) }, opts.org)).layout);
}

export async function cmdLayoutsPatch(layoutId: string, opts: { atVersion: string; file: string; org?: string }) {
  print((await layoutsApi.patch(await token(), layoutId, { version: Number(opts.atVersion), spec: specOf(opts.file) }, opts.org)).layout);
}
