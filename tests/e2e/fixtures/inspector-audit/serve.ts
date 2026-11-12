import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localEnv } from '../../../../scripts/local.mjs';
import { writeAuditFile } from './fixture';

const port = process.argv[2] ?? '4391';
const file = join(tmpdir(), `feega-inspector-audit-${port}.feega`);
writeAuditFile(file);

const server = spawn('npx', ['vite', 'dev', '--host', '127.0.0.1', '--port', port, '--strictPort'], { stdio: 'inherit', env: { ...localEnv(file, port, process.env, {}), PUBLIC_FEEGA_LOCAL_AI: '0', NO_HMR: '1' } });
const stop = (signal: NodeJS.Signals) => server.kill(signal);
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', (code) => process.exit(code ?? 0));
