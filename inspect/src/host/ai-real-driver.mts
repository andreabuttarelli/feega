import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AiState, ToHost, ToView, type HostMessage, type ViewMessage } from '../messages';
import { memoryAccountStore } from './account';
import { memoryOnboardingStore } from './onboarding';
import { inspectSession } from './session';
import { AgentEventKind } from './ai/agent-session';

for (const k of Object.keys(process.env)) { if (/API_KEY|_TOKEN$/.test(k)) delete process.env[k]; }
const id = process.argv[2];
const APP = process.argv[3];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (f: () => boolean, ms: number) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) return false; await sleep(50); } return true; };

const dir = mkdtempSync(join(tmpdir(), 'ai-real-'));
cpSync(APP, dir, { recursive: true });
const sent: ViewMessage[] = [];
let handle: (m: HostMessage) => unknown = () => undefined;
const platform: any = {
  version: '1', launcher: '', send: (m: ViewMessage) => void sent.push(m), receive: (h: any) => void (handle = h),
  settings: () => ({}), stored: () => undefined, store: async () => undefined, log: () => undefined,
  confirm: async () => true, account: memoryAccountStore(), onboarding: memoryOnboardingStore()
};
const session = inspectSession(platform, dir);
const send = (m: HostMessage) => handle(m);
const events = () => sent.flatMap((m) => (m.kind === ToView.AiEvent ? [m.event] : []));
const out: Record<string, unknown> = { agent: id };
const read = () => readFileSync(join(dir, 'src/App.jsx'), 'utf8');
const orig = read();

let answered = 0;
const answerer = setInterval(() => {
  for (const e of events()) {
    if (e.kind === AgentEventKind.Permission && !(e as any).done) {
      (e as any).done = true;
      const o = e.options.find((x) => x.allows);
      ((out.permissions ??= []) as string[]).push(`${e.tool.kind}:${e.tool.title}`.slice(0, 80));
      void send({ kind: ToHost.AiAnswer, id: e.id, optionId: o?.id ?? null });
      answered++;
    }
  }
}, 100);

void (async () => {
const t0 = Date.now();
await send({ kind: ToHost.AiStart, agent: id as any });
const started = await until(() => sent.some((m) => m.kind === ToView.AiState && (m.state === AiState.Ready || m.state === AiState.Idle)) && (sent.some((m) => m.kind === ToView.AiState && m.state === AiState.Ready) || events().some((e) => e.kind === AgentEventKind.Failed)), 90000);
out.handshake = sent.some((m) => m.kind === ToView.AiState && m.state === AiState.Ready) ? `ok ${Date.now() - t0}ms` : `FAIL ${JSON.stringify(events().filter((e) => e.kind === AgentEventKind.Failed))}`;
const modes = events().find((e) => e.kind === AgentEventKind.Modes) as any;
out.modes = modes ? `${modes.available.map((m: any) => m.id).join(',')} (current ${modes.current})` : 'none';

if (String(out.handshake).startsWith('ok')) {
  if (process.env.MODE) { await send({ kind: (ToHost as any).AiMode, id: process.env.MODE } as any); await sleep(500); out.modeSet = process.env.MODE; }
  const n0 = events().length;
  await send({ kind: ToHost.AiSend, text: 'make this heading smaller', context: 'Feega selection\nsource: src/App.jsx:4:7\nelement: <h1 style="font-size:48px">Hello Feega</h1>\nOnly edit src/App.jsx. Be brief.' });
  const done = await until(() => events().slice(n0).some((e) => e.kind === AgentEventKind.Done || e.kind === AgentEventKind.Failed), 240000);
  const ev = events().slice(n0);
  const text = ev.flatMap((e) => (e.kind === AgentEventKind.Text ? [e.text] : [])).join('');
  out.streamChunks = ev.filter((e) => e.kind === AgentEventKind.Text).length;
  out.reply = text.slice(0, 120);
  out.end = done ? JSON.stringify(ev.at(-1)) : 'TIMEOUT';
  out.tools = ev.filter((e) => e.kind === AgentEventKind.Tool).map((e: any) => `${e.tool.kind}/${e.tool.status}`).slice(0, 12);
  await sleep(500);
  out.fileChanged = read() !== orig;
  out.fileNow = read().match(/<h1[^>]*>/)?.[0];
  const hist = sent.flatMap((m) => (m.kind === ToView.History ? [m.changes] : [])).at(-1) ?? [];
  out.changes = hist.map((c) => `${c.prop}=${c.value} by=${c.by ?? ''} ${c.files.join(',')}`);
  const row = hist[0];
  if (row) {
    await send({ kind: ToHost.Revert, id: row.id });
    await sleep(800);
    out.undoRestoresFile = read() === orig;
  }
  const n1 = events().length;
  if (done && out.end !== 'TIMEOUT' && !String(out.end).includes('failed')) {
    void send({ kind: ToHost.AiSend, text: 'Count from 1 to 300, one number per line, in your reply. Do not use tools.', context: null });
    await until(() => events().length > n1, 60000);
    await sleep(1500);
    await send({ kind: ToHost.AiCancel });
    const c = await until(() => events().slice(n1).some((e) => e.kind === AgentEventKind.Done || e.kind === AgentEventKind.Failed), 30000);
    out.cancel = c ? JSON.stringify(events().slice(n1).at(-1)) : 'TIMEOUT';
  }
}
clearInterval(answerer);
writeFileSync(join(tmpdir(), `ai-real-${id}-events.json`), JSON.stringify(events(), null, 1));
out.answered = answered;
console.log('RESULT ' + JSON.stringify(out, null, 1));
await session.stop();
process.exit(0);
})();
