import { execFile } from 'node:child_process';
import { MIN_NODE_MAJOR, nodeSupported } from '../../../npx/src/node-version';

export enum NodeProblem {
  NodeMissing = 'node-missing',
  NodeOld = 'node-old',
  NpmMissing = 'npm-missing'
}

export type NodeCheck = { ok: true; node: string } | { ok: false; problem: NodeProblem; message: string };

export type RunTool = (command: string) => Promise<string>;

const VERSION_TIMEOUT_MS = 8000;
const LEADING_V = /^v/;

export const runTool: RunTool = (command) =>
  new Promise((resolve, reject) => {
    execFile(command, ['--version'], { timeout: VERSION_TIMEOUT_MS, shell: process.platform === 'win32' }, (error, stdout) => (error ? reject(error) : resolve(stdout)));
  });

export async function checkNode(run: RunTool): Promise<NodeCheck> {
  const node = (await run('node').catch(() => '')).trim().replace(LEADING_V, '');
  if (!node) {
    return { ok: false, problem: NodeProblem.NodeMissing, message: 'Feega needs Node.js and it was not found on this computer.' };
  }
  if (!nodeSupported(node)) {
    return { ok: false, problem: NodeProblem.NodeOld, message: `Feega needs Node.js ${MIN_NODE_MAJOR} or newer. Found ${node}.` };
  }
  const npm = (await run('npm').catch(() => '')).trim();
  if (!npm) {
    return { ok: false, problem: NodeProblem.NpmMissing, message: 'npm was not found. It comes with Node.js: reinstall Node.js.' };
  }
  return { ok: true, node };
}
