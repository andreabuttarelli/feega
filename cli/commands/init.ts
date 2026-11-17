import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { formatPlan, planInit, PROBED_FILES, type Files } from '../lib/init.ts';

type InitOpts = { dryRun?: boolean; yes?: boolean };

export async function cmdInit(dir: string, opts: InitOpts) {
  const root = resolve(dir);
  const plan = tryPlan(readProject(root));
  console.log(formatPlan(plan));

  const changes = Object.keys(plan.edits);
  if (changes.length === 0 || opts.dryRun) {
    return;
  }
  if (!opts.yes && !(await confirm('Apply these changes?'))) {
    console.log('Nothing written.');
    return;
  }

  for (const name of changes) {
    writeFileSync(join(root, name), plan.edits[name]);
  }
  console.log(`\nWritten: ${changes.join(', ')}. Install dependencies, then start your dev server.`);
}

function readProject(root: string): Files {
  const present = PROBED_FILES.filter((name) => existsSync(join(root, name)));
  return Object.fromEntries(present.map((name) => [name, readFileSync(join(root, name), 'utf8')]));
}

function tryPlan(files: Files) {
  try {
    return planInit(files);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\n${question} [y/N] `);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}
