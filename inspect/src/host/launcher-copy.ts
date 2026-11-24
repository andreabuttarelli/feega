import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function copyFile(from: string, to: string): Promise<void> {
  const staged = `${to}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(staged, await readFile(from));
  await rename(staged, to);
}

export async function copyLauncher(source: string, target: string): Promise<void> {
  await mkdir(target, { recursive: true });

  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(target, entry.name);

    if (entry.isDirectory()) {
      await copyLauncher(from, to);
      continue;
    }
    await copyFile(from, to);
  }
}
