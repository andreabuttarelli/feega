import { join } from 'node:path';
import type { Catalog } from '../../../packages/library/src/catalog';
import { planInit, type Files } from '../init';
import { composeProject, projectName } from './compose';
import { STACKS, Stack } from './stacks';
import type { Template } from './templates';

export enum Step {
  Files = 'files',
  Plugin = 'plugin',
  Install = 'install',
  Done = 'done'
}

export type ScaffoldPorts = {
  occupied: (dir: string) => Promise<boolean>;
  write: (dir: string, files: Files) => Promise<void>;
  install: (dir: string, onLine: (line: string) => void) => Promise<void>;
};

export type ScaffoldAsk = { parent: string; stack: Stack; template: Template; name: string; catalog: Catalog };

export type Scaffolded = { ok: true; dir: string } | { ok: false; reason: string };

export type Progress = (step: Step, line?: string) => void;

export async function scaffoldProject({ parent, stack, template, name, catalog }: ScaffoldAsk, ports: ScaffoldPorts, progress: Progress): Promise<Scaffolded> {
  const dir = join(parent, projectName(name).slug);
  if (await ports.occupied(dir)) {
    return { ok: false, reason: `${dir} already has files. Pick another name or folder.` };
  }

  progress(Step.Files);
  const composed = await composeProject({ stack, template, name, catalog });
  if (!composed.ok) {
    return composed;
  }

  try {
    const files = { ...composed.files };
    if (STACKS[stack].plugin) {
      progress(Step.Plugin);
      Object.assign(files, planInit(files).edits);
    }
    await ports.write(dir, files);
    progress(Step.Install);
    await ports.install(dir, (line) => progress(Step.Install, line));
  } catch (error) {
    return { ok: false, reason: (error as Error).message };
  }

  progress(Step.Done);
  return { ok: true, dir };
}
