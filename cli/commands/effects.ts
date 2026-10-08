import { readFileSync } from 'node:fs';
import { loadSession } from '../lib/auth.ts';
import { effectsApi, type WrittenEffect } from '../lib/effects.ts';

async function token(): Promise<string> {
  const session = await loadSession();
  if (!session) {
    console.error('Session expired or missing. Run: feega login');
    process.exit(1);
  }
  return session.access_token;
}

function printWritten({ effect }: WrittenEffect) {
  console.log(`${effect.id}  ${effect.name}  v${effect.version}  ${effect.check.state}`);
  effect.check.problems.forEach((p) => console.log(`  ${p}`));
}

export async function cmdEffects(opts: { org?: string }) {
  const { effects, custom } = await effectsApi.list(await token(), opts.org);
  console.log(`Built-in: ${effects.map((e) => e.id).join(', ')}`);
  if (!custom.length) {
    console.log('No custom effects yet: feega effects write <name> --file effect.glsl');
    return;
  }
  for (const e of custom) {
    const cost = e.cost_ms === null ? '' : `  ${e.cost_ms.toFixed(1)} ms`;
    console.log(`${e.effect_id}  ${e.name}  v${e.version}  ${e.state}${cost}`);
  }
}

export async function cmdEffectsWrite(name: string, opts: { file: string; params?: string; org?: string }) {
  const frag = readFileSync(opts.file, 'utf8');
  const params = opts.params ? (JSON.parse(readFileSync(opts.params, 'utf8')) as unknown[]) : [];
  printWritten(await effectsApi.write(await token(), { name, frag, params }, opts.org));
}

export async function cmdEffectsPatch(effectId: string, opts: { atVersion: string; file: string; org?: string }) {
  const frag = readFileSync(opts.file, 'utf8');
  printWritten(await effectsApi.patch(await token(), effectId, { version: Number(opts.atVersion), frag }, opts.org));
}
