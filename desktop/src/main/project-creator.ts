import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Catalog } from '../../../packages/library/src/catalog';
import { scaffoldProject, type ScaffoldPorts, type Scaffolded } from '../../../cli/lib/scaffold/scaffold';
import { Step } from '../../../cli/lib/scaffold/step';
import type { Stack } from '../../../cli/lib/scaffold/stacks';
import type { Template } from '../../../cli/lib/scaffold/templates';

const INSTALL_ARGS = ['install', '--no-audit', '--no-fund', '--no-progress'];
const TAIL_LINES = 3;

export type NewProjectAsk = { parent: string; name: string; stack: Stack; template: Template };

export type ProjectProgress = { name: string; step: Step; line: string };

export const nodePorts = (): ScaffoldPorts => ({
  occupied: async (dir) => (await readdir(dir).catch(() => [])).length > 0,
  write: async (dir, files) => {
    for (const [name, text] of Object.entries(files)) {
      await mkdir(dirname(join(dir, name)), { recursive: true });
      await writeFile(join(dir, name), text);
    }
  },
  install: (dir, onLine) =>
    new Promise((resolve, reject) => {
      const child = spawn('npm', INSTALL_ARGS, { cwd: dir, shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
      const tail: string[] = [];
      const take = (chunk: Buffer) => {
        for (const line of chunk.toString('utf8').split('\n').map((l) => l.trim()).filter(Boolean)) {
          tail.push(line);
          onLine(line);
        }
      };
      child.stdout.on('data', take);
      child.stderr.on('data', take);
      child.on('error', (error) => reject(error));
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`npm install failed: ${tail.slice(-TAIL_LINES).join(' | ')}`))));
    })
});

export const catalogAt = async (dir: string): Promise<Catalog> => JSON.parse(await readFile(join(dir, 'library.json'), 'utf8')) as Catalog;

export function projectCreator(catalog: () => Promise<Catalog>, ports: ScaffoldPorts, progress: (state: ProjectProgress | null) => void) {
  return async (ask: NewProjectAsk): Promise<Scaffolded> => {
    let last: ProjectProgress = { name: ask.name, step: Step.Files, line: '' };
    const tell = (step: Step, line = '') => progress((last = { name: ask.name, step, line: line || last.line }));
    tell(Step.Files);
    try {
      return await scaffoldProject({ ...ask, catalog: await catalog() }, ports, tell);
    } catch (error) {
      return { ok: false, reason: (error as Error).message };
    }
  };
}
