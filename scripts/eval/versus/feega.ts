import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BrowserContext, Page } from 'playwright';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createE2eSession, signInE2e, teardownE2eSession } from '../../../tests/e2e/fixtures/session';
import { drive, exportMp4, say } from '../motion-quality/editor';
import { spentUsd } from '../motion-quality/score';
import type { AgentState } from '../motion-quality/drive';
import { briefText, type Brief } from './briefs';
import type { Usage } from './plain-result';

export const FEEGA_VIDEO = 'feega.mp4';
export const FEEGA_RESULT = 'feega.json';

const WATCH_MS = 60_000;
export const STALL_MS = 8 * 60_000;
const UPLOAD_MS = 120_000;

type Call = { prompt_tokens: number | null; completion_tokens: number | null; cached_tokens: number | null; cost_usd: number | null };

export type FeegaResult = { video: boolean; usage: Usage; wallS: number; failure: string | null };

export function feegaUsage(calls: readonly Call[]): Usage {
  const sum = (k: keyof Call) => calls.reduce((s, c) => s + Number(c[k] ?? 0), 0);
  return { inputTokens: sum('prompt_tokens'), outputTokens: sum('completion_tokens'), cacheReadTokens: sum('cached_tokens'), cacheWriteTokens: 0, costUsd: spentUsd(calls) };
}

export type Progress = { atS: number; spentUsd: number; running: boolean | null; messages: number };

export function stalled(log: readonly Progress[], stallS = STALL_MS / 1000): string | null {
  const last = log.at(-1);
  if (!last || last.atS < stallS || last.spentUsd > 0) {
    return null;
  }
  return `stalled: $0 spent after ${Math.round(last.atS)} s (agent running=${last.running}, ${last.messages} messages)`;
}

async function attach(page: Page, files: string[]): Promise<void> {
  if (!files.length) {
    return;
  }
  const form = page.locator('form.composer');
  await form.locator('input[type="file"]').setInputFiles(files);
  await form.locator('.chip').first().waitFor({ timeout: UPLOAD_MS });
  await form.locator('[role="progressbar"]').first().waitFor({ state: 'detached', timeout: UPLOAD_MS }).catch(() => {});
}

export async function runFeega(brief: Brief, fixtures: string, dir: string, context: BrowserContext, admin: SupabaseClient, baseUrl: string): Promise<FeegaResult> {
  mkdirSync(dir, { recursive: true });
  const session = await createE2eSession();
  const t0 = Date.now();
  const log: Progress[] = [];
  const errors: string[] = [];
  let timer: ReturnType<typeof setInterval> | undefined;
  const calls = async () => ((await admin.from('ai_calls').select('prompt_tokens, completion_tokens, cached_tokens, cost_usd').eq('org_id', session.orgId)).data ?? []) as Call[];
  try {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => (m.type() === 'error' ? errors.push(`console: ${m.text()}`) : undefined));
    await signInE2e(page, session).catch(() => signInE2e(page, session));
    await page.goto(`${baseUrl}/app/motion`);
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="motion-new"] input[name="name"]').fill(brief.name);
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/\/motion\//);
    await page.getByTestId('motion-preview').waitFor();
    await page.waitForLoadState('networkidle');
    const nodeId = page.url().split('/motion/')[1].split(/[?#/]/)[0];
    const agentUrl = `/api/v1/projects/${session.projectId}/motion/${nodeId}/agent`;

    await attach(page, brief.files.map((f) => join(fixtures, f)));
    const input = page.locator('#chat-composer-input');
    await input.fill(briefText(brief));
    await input.press('Enter');
    say(`  sent; node ${nodeId}`);
    await page.screenshot({ path: join(dir, 'sent.png') });

    const watchdog = new Promise<never>((_, fail) => {
      timer = setInterval(async () => {
        const r = await page.request.get(agentUrl).catch(() => null);
        const state: AgentState | null = r?.ok() ? await r.json() : null;
        log.push({ atS: (Date.now() - t0) / 1000, spentUsd: spentUsd(await calls()), running: state?.running ?? null, messages: state?.messages.length ?? 0 });
        await page.screenshot({ path: join(dir, `progress-${log.length}.png`) }).catch(() => {});
        writeFileSync(join(dir, 'progress.json'), JSON.stringify(log, null, 1));
        const stall = stalled(log);
        if (stall) {
          fail(new Error(stall));
        }
      }, WATCH_MS);
    });
    await Promise.race([drive(page, agentUrl, null), watchdog]);
    clearInterval(timer);
    const wallS = (Date.now() - t0) / 1000;

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: join(dir, 'editor.png') });
    const usage = feegaUsage(await calls());
    const video = join(dir, FEEGA_VIDEO);
    const exported = await exportMp4(page, video).then(
      () => null,
      async (e) => {
        await page.screenshot({ path: join(dir, 'export-failure.png') });
        return `export failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    );
    return { video: existsSync(video), usage, wallS, failure: existsSync(video) ? null : (exported ?? 'no video exported') };
  } catch (e) {
    return { video: false, usage: feegaUsage(await calls()), wallS: (Date.now() - t0) / 1000, failure: e instanceof Error ? e.message : String(e) };
  } finally {
    clearInterval(timer);
    writeFileSync(join(dir, 'page-errors.txt'), errors.join('\n'));
    const msgs = (await admin.from('chat_messages').select('*').eq('org_id', session.orgId).order('seq')).data ?? [];
    writeFileSync(join(dir, 'chat_messages.json'), JSON.stringify(msgs, null, 1));
    await teardownE2eSession(session).catch((e) => say(`  TEARDOWN FAILED ${session.orgId}: ${e}`));
  }
}
