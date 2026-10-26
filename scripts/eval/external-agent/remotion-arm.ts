import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import type { ToolOutput, Tools } from './agent-loop';

const run = promisify(execFile);

const REMOTION_VERSION = '4.0.538';
const COMMAND_TIMEOUT_MS = 8 * 60 * 1000;
const OUTPUT_BUFFER_BYTES = 8 * 1024 * 1024;
const STILL_FILE = 'out/_check.png';

export type RemotionProject = { dir: string; setupSeconds: number };

export async function prepareRemotionProject(): Promise<RemotionProject> {
  const started = Date.now();
  const dir = mkdtempSync(join(tmpdir(), 'remotion-eval-'));
  const deps = Object.fromEntries(['remotion', '@remotion/cli'].map((n) => [n, REMOTION_VERSION]));
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'launch-video', private: true, type: 'module', dependencies: { ...deps, react: '19.0.0', 'react-dom': '19.0.0' }, devDependencies: { typescript: '5.8.3', '@types/react': '19.0.0' } }, null, 2)
  );
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', strict: true, skipLibCheck: true } }));
  mkdirSync(join(dir, 'out'), { recursive: true });

  await run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: dir, maxBuffer: OUTPUT_BUFFER_BYTES });
  await run('npx', ['remotion', 'browser', 'ensure'], { cwd: dir, maxBuffer: OUTPUT_BUFFER_BYTES });
  return { dir, setupSeconds: (Date.now() - started) / 1000 };
}

function inside(dir: string, relative: string): string {
  const full = resolve(dir, relative);
  if (full !== dir && !full.startsWith(dir + sep)) {
    throw new Error('path escapes the project directory');
  }
  return full;
}

async function shell(dir: string, command: string): Promise<ToolOutput> {
  try {
    const { stdout, stderr } = await run('bash', ['-lc', command], { cwd: dir, timeout: COMMAND_TIMEOUT_MS, maxBuffer: OUTPUT_BUFFER_BYTES });
    return { text: `exit 0\n${stdout}${stderr}`.slice(-6000), images: [] };
  } catch (e) {
    const err = e as { code?: number; stdout?: string; stderr?: string; killed?: boolean };
    return { text: `error: exit ${err.killed ? 'timeout' : err.code}\n${err.stdout ?? ''}${err.stderr ?? ''}`.slice(-6000), images: [] };
  }
}

async function stillOf(dir: string, args: Record<string, unknown>): Promise<ToolOutput> {
  const entry = String(args.entry ?? 'src/index.ts');
  const composition = String(args.composition ?? 'Launch');
  const frame = Number(args.frame ?? 0);
  const out = await shell(dir, `npx remotion still ${entry} ${composition} ${STILL_FILE} --frame=${frame} --scale=0.5`);
  const file = join(dir, STILL_FILE);
  if (out.text.startsWith('error') || !existsSync(file)) {
    return out.text.startsWith('error') ? out : { text: 'error: no still was written', images: [] };
  }
  return { text: `frame ${frame} of ${composition} at half size`, images: [{ mime: 'image/png', data: readFileSync(file).toString('base64') }] };
}

export function remotionTools(dir: string): Tools {
  return {
    specs: [
      {
        name: 'write_file',
        description: 'Write a text file inside the Remotion project directory (creates folders). Overwrites.',
        parameters: { type: 'object', properties: { path: { type: 'string', description: 'relative path, e.g. src/Root.tsx' }, content: { type: 'string' } }, required: ['path', 'content'] }
      },
      {
        name: 'run',
        description: 'Run a bash command in the project directory (npm, npx remotion, ls, cat). Output is truncated to the last 6000 characters.',
        parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] }
      },
      {
        name: 'view_frame',
        description: 'Render one frame of a composition to a half-size PNG and show it to you, to check your own work.',
        parameters: { type: 'object', properties: { entry: { type: 'string', description: 'default src/index.ts' }, composition: { type: 'string', description: 'composition id, default Launch' }, frame: { type: 'number' } }, required: ['frame'] }
      }
    ],
    call: async (name, args) => {
      if (name === 'write_file') {
        const file = inside(dir, String(args.path ?? ''));
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, String(args.content ?? ''));
        return { text: `wrote ${args.path}`, images: [] };
      }
      if (name === 'run') {
        return shell(dir, String(args.command ?? ''));
      }
      if (name === 'view_frame') {
        return stillOf(dir, args);
      }
      return { text: `error: unknown tool ${name}`, images: [] };
    }
  };
}

export function findRenderedVideo(dir: string): string | null {
  const out = join(dir, 'out');
  const preferred = join(out, 'launch.mp4');
  if (existsSync(preferred)) {
    return preferred;
  }
  const any = existsSync(out) ? readdirSync(out).find((f) => f.endsWith('.mp4')) : undefined;
  return any ? join(out, any) : null;
}
