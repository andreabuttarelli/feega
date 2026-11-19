import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { chosenApp, type AppChoice, type Tree } from '../../inspect/src/host/app-root';
import { nodePlatform } from '../../inspect/src/host/node-platform';
import { inspectSession } from '../../inspect/src/host/session';
import { Browser, Run, USAGE, argsOf } from './args';
import { editorServer } from './editor-server';

declare const FEEGA_VERSION: string;

const MIN_NODE_MAJOR = 20;
const KEEP_RUNNING = -1;

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
  if (Number(process.versions.node.split('.')[0]) < MIN_NODE_MAJOR) {
    say(`feega: Node ${MIN_NODE_MAJOR}+ is required (found ${process.versions.node})`);
    return 1;
  }
  const args = argsOf(process.argv.slice(2), process.cwd());
  if (args.run === Run.Help) {
    say(USAGE);
    return 0;
  }
  if (args.run === Run.Version) {
    say(FEEGA_VERSION);
    return 0;
  }
  if (args.run === Run.Error) {
    say(`feega: ${args.reason}\n\n${USAGE}`);
    return 1;
  }

  const root = await chosenApp(args.dir, args.dir, tree, askApp);
  if (!root) {
    say(`feega: no web app (package.json) in ${args.dir}`);
    return 1;
  }

  const editor = await editorServer(join(__dirname, 'webview'), args.port);
  const platform = nodePlatform({ root, launcher: join(__dirname, 'launcher'), version: FEEGA_VERSION, transport: editor.transport, print: say });
  const session = inspectSession(platform, root);

  const stop = async () => {
    session.stop();
    await editor.close();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  say(`feega: editing ${root}`);
  say('feega: starting its dev server…');
  const started = await session.start();
  if ('refused' in started) {
    say(`feega: ${started.refused}`);
  }
  say(`feega: editor ready on ${editor.url}  (Ctrl+C to stop)`);
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
