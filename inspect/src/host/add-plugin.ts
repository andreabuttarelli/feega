import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PROBED_FILES, planInit, type Files } from '../../../cli/lib/init';

export type PluginAdded = { ok: true; files: string[] } | { ok: false; reason: string };

async function probed(appRoot: string): Promise<Files> {
  const files: Files = {};
  for (const name of PROBED_FILES) {
    const text = await readFile(join(appRoot, name), 'utf8').catch(() => null);
    if (text !== null) {
      files[name] = text;
    }
  }
  return files;
}

export async function addPlugin(appRoot: string): Promise<PluginAdded> {
  try {
    const { edits } = planInit(await probed(appRoot));
    await Promise.all(Object.entries(edits).map(([name, text]) => writeFile(join(appRoot, name), text)));
    return { ok: true, files: Object.keys(edits) };
  } catch (error) {
    return { ok: false, reason: (error as Error).message };
  }
}
