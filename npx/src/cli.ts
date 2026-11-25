import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { chosenApp, type AppChoice, type Tree } from '../../inspect/src/host/app-root';
import { nodePlatform } from '../../inspect/src/host/node-platform';
import { terminalTip } from '../../inspect/src/host/skill-hint';
import { killOrphans } from '../../inspect/src/host/orphans';
import { inspectSession, memoOf } from '../../inspect/src/host/session';
import { Browser, Run, argsOf, usageOf } from './args';
import { cloudEnabled, cloudPorts } from '../../inspect/src/cloud-flag';
import { editorServer } from '../../inspect/src/host/editor-server';
import { serveMcp } from './mcp/run';
import { fileAccountStore } from '../../inspect/src/host/account';
import { shareHost } from '../../inspect/src/host/share/share-host';
import { cloudShare } from '../../inspect/src/host/share/share-port-factory';
import { cloudApiOf, relayUrlOf } from './cloud';
import { pluginsRoot } from '../../packages/plugin-store/src/registry';
import { runPlugin, terminalIo } from './plugin-cli';
import { MIN_NODE_MAJOR, nodeSupported } from './node-version';

declare const FEEGA_VERSION: string;

const KEEP_RUNNING = -1;
const STOP_ON_STDIN_END = 'FEEGA_STOP_ON_STDIN_END';

const say = (line: string) => console.log(line);

const tree: Tree = {
  has: (path) => access(path).then(() => true, () => false),
  dirs: (path) => readdir(path, { withFileTypes: true }).then((all) => all.filter((e) => e.isDirectory()).map((e) => e.name), () => [])
};

async function askApp(apps: AppChoice[]): Promise<string | null> {
  if (!process.stdin.isTTY) {
    say(`feega: several apps here (${apps.map((a) => a.label).join(', ')}): run npx feega <dir>`);
    return null;
  }
  apps.forEach((app, i) => say(`  ${i + 1}) ${app.label}`));
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await prompt.question('feega: which app? (number) ')).trim();
  prompt.close();
  return apps.find((app, i) => answer === app.label || answer === String(i + 1))?.app ?? null;
}

async function main(): Promise<number> {
  if (!nodeSupported(process.versions.node)) {
    say(`feega: Node ${MIN_NODE_MAJOR}+ is required (found ${process.versions.node})`);
    return 1;
  }
  const cloud = cloudEnabled({ setting: undefined, env: process.env });
  const args = argsOf(process.argv.slice(2), process.cwd());
  if (args.run === Run.Help) {
    say(usageOf());
    return 0;
  }
  if (args.run === Run.Version) {
    say(FEEGA_VERSION);
    return 0;
  }
  if (args.run === Run.Mcp) {
    await serveMcp({ cli: __filename, version: FEEGA_VERSION, cwd: process.cwd(), env: process.env, share: shareHost({ api: cloudApiOf(process.env, fileAccountStore()), relayUrl: relayUrlOf(process.env), send: fetch }) });
    return KEEP_RUNNING;
  }
  if (args.run === Run.Plugin) {
    return runPlugin(terminalIo(pluginsRoot(), say), args.action, args.value);
  }
  if (args.run === Run.Error) {
    say(`feega: ${args.reason}\n\n${usageOf()}`);
    return 1;
  }

  const root = args.url ? args.dir : await chosenApp(args.dir, args.dir, tree, askApp);
  if (!root) {
    say(`feega: no web app (package.json) in ${args.dir}`);
    return 1;
  }

  const editor = await editorServer(join(__dirname, 'webview'), args.port);
  const account = fileAccountStore();
  const ports = cloudPorts(cloud, () => cloudShare({ api: cloudApiOf(process.env, account), relayUrl: relayUrlOf(process.env), send: fetch, editorUrl: async () => editor.url }));
  const host = nodePlatform({ root, launcher: join(__dirname, 'launcher'), version: FEEGA_VERSION, transport: editor.transport, print: say, account, ...ports, plugins: { root: pluginsRoot(), dev: () => args.devPlugins ?? [] } });
  const platform = args.url ? { ...host, chooseApp: (apps: string[]) => askApp(apps.map((app) => ({ label: app || '.', app }))) } : host;
  await killOrphans(memoOf(platform));
  const session = inspectSession(platform, root);

  const stop = async () => {
    await session.stop();
    await editor.close();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  if (process.env[STOP_ON_STDIN_END]) {
    process.stdin.once('end', stop).resume();
  }

  say(`feega: editing ${root}`);
  say(args.url ? `feega: attaching to ${args.url}` : 'feega: starting its dev server…');
  const started = await (args.url ? session.attachUrl(args.url) : session.start());
  if ('refused' in started && started.attachRefused) {
    await session.stop();
    await editor.close();
    return 1;
  }
  if ('refused' in started) {
    say(`feega: ${started.refused}`);
  } else {
    say(started.attached ? `feega: attached to a dev server Feega did not start (${started.command}); app on ${started.url}` : `feega: started the dev server (${started.command}); app on ${started.url}`);
  }
  say(`feega: editor ready on ${editor.url}  (Ctrl+C to stop)`);
  const tip = await terminalTip({ platform, roots: [root, args.dir], interactive: Boolean(process.stdout.isTTY) && !process.env.CI });
  if (tip) {
    say(tip);
  }
  if (args.browser === Browser.Open) {
    await platform.openExternal(editor.url);
  }
  return KEEP_RUNNING;
}

main().then(
  (code) => code !== KEEP_RUNNING && process.exit(code),
  (error: Error) => {
    say(`feega: ${error.message}`);
    process.exit(1);
  }
);
