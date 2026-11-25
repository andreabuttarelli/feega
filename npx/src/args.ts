import { resolve } from 'node:path';
import { urlOf } from '../../inspect/src/host/attach-url';
import { PLUGIN_COMMAND, PluginAction, pluginArgsOf } from './plugin-args';

export enum Run {
  Editor = 'editor',
  Help = 'help',
  Version = 'version',
  Mcp = 'mcp',
  Plugin = 'plugin',
  Error = 'error'
}

export enum Browser {
  Open = 'open',
  Stay = 'stay'
}

export type Args =
  | { run: Run.Editor; dir: string; port: number; browser: Browser; url?: string; devPlugins?: string[] }
  | { run: Run.Help }
  | { run: Run.Version }
  | { run: Run.Mcp }
  | { run: Run.Plugin; action: Exclude<PluginAction, PluginAction.Dev>; value: string }
  | { run: Run.Error; reason: string };

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

const PLUGIN_USAGE = `

Usage: npx feega plugin add <github:owner/repo[@tag] | npm-name[@version]>
       npx feega plugin remove <id>
       npx feega plugin list
       npx feega plugin dev <folder> [dir] [options]

Installs, removes and lists third-party plugins (kept in ~/.feega/plugins),
or opens the editor with a plugin folder you are developing, reloaded on change.
Plugins are not reviewed by Feega: add shows what one may do and asks first.`;

const MCP_USAGE = `

Usage: npx feega mcp

Serves Feega to a coding agent over MCP on stdio: the element selected
and the changes made in the running editor, and Feega Cloud sharing and
comments. Cloud needs npx feega sign-in once, or FEEGA_API_KEY.`;

export const usageOf = (): string => EDITOR_USAGE + PLUGIN_USAGE + MCP_USAGE;

const MCP_COMMAND = 'mcp';

const FLAGS: Record<string, Run.Help | Run.Version> = { '--help': Run.Help, '-h': Run.Help, '--version': Run.Version, '-v': Run.Version };

function pluginRun(argv: string[], cwd: string): Args {
  const parsed = pluginArgsOf(argv);
  if ('error' in parsed) {
    return { run: Run.Error, reason: parsed.error };
  }
  if (parsed.action !== PluginAction.Dev) {
    return { run: Run.Plugin, action: parsed.action, value: parsed.value };
  }
  const editor = argsOf(parsed.rest, cwd);
  return editor.run === Run.Editor ? { ...editor, devPlugins: [resolve(cwd, parsed.value)] } : editor;
}

export function argsOf(argv: string[], cwd: string): Args {
  let dir = cwd;
  let port = 0;
  let browser = Browser.Open;
  let url: string | undefined;
  const rest = [...argv];

  if (rest[0] === MCP_COMMAND) {
    return { run: Run.Mcp };
  }

  if (rest[0] === PLUGIN_COMMAND) {
    return pluginRun(rest.slice(1), cwd);
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
