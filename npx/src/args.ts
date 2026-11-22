import { resolve } from 'node:path';
import { urlOf } from '../../inspect/src/host/attach-url';

export enum Run {
  Editor = 'editor',
  Help = 'help',
  Version = 'version',
  Mcp = 'mcp',
  Error = 'error'
}

export enum Browser {
  Open = 'open',
  Stay = 'stay'
}

export type Args = { run: Run.Editor; dir: string; port: number; browser: Browser; url?: string } | { run: Run.Help } | { run: Run.Version } | { run: Run.Mcp } | { run: Run.Error; reason: string };

const EDITOR_USAGE = `Usage: npx feega [dir] [--url <address>] [--port N] [--no-open]

Opens the Feega editor on the web app in [dir] (default: this folder):
starts its dev server, then a design panel in your browser. Edits are
written to your source files.

  --url <addr> attach to a dev server that already runs (never starts
               or stops it), e.g. --url http://localhost:5173
  --port N     port of the editor (default: a free one)
  --no-open    do not open the browser
  --help       this text
  --version    the version`;

const MCP_USAGE = `

Usage: npx feega mcp

Serves the Feega Cloud tools (share, comments) to a coding agent over
MCP on stdio. Sign in once with npx feega, or set FEEGA_API_KEY.`;

export const usageOf = (cloud: boolean): string => (cloud ? EDITOR_USAGE + MCP_USAGE : EDITOR_USAGE);

const MCP_COMMAND = 'mcp';

const FLAGS: Record<string, Run.Help | Run.Version> = { '--help': Run.Help, '-h': Run.Help, '--version': Run.Version, '-v': Run.Version };

export function argsOf(argv: string[], cwd: string, cloud = false): Args {
  let dir = cwd;
  let port = 0;
  let browser = Browser.Open;
  let url: string | undefined;
  const rest = [...argv];

  if (cloud && rest[0] === MCP_COMMAND) {
    return { run: Run.Mcp };
  }

  while (rest.length) {
    const arg = rest.shift()!;
    if (FLAGS[arg]) {
      return { run: FLAGS[arg] } as Args;
    }
    if (arg === '--no-open') {
      browser = Browser.Stay;
      continue;
    }
    if (arg === '--port' || arg.startsWith('--port=')) {
      port = Number(arg === '--port' ? rest.shift() : arg.slice('--port='.length));
      if (!Number.isInteger(port)) {
        return { run: Run.Error, reason: 'the port must be a number' };
      }
      continue;
    }
    if (arg === '--url' || arg.startsWith('--url=')) {
      const found = urlOf((arg === '--url' ? rest.shift() : arg.slice('--url='.length)) ?? '');
      if (!found) {
        return { run: Run.Error, reason: 'the --url must be a web address like http://localhost:5173' };
      }
      url = found;
      continue;
    }
    if (arg.startsWith('-')) {
      return { run: Run.Error, reason: `unknown option ${arg}` };
    }
    dir = resolve(cwd, arg);
  }

  return { run: Run.Editor, dir, port, browser, ...(url && { url }) };
}
