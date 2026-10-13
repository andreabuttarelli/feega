import type { Page } from 'playwright';
import { AccountGiven, accountAfter, asksUser, cutAnswerFor, replyTo, turnSettled, type AgentState, type TestAccount } from './drive';

const TURN_CAP_MS = 40 * 60_000;
const EXPORT_TIMEOUT_MS = 45 * 60_000;
const POLL_MS = 10_000;
const MAX_REPLIES = 3;
const PICK_COUNT = 3;

export const say = (s: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);

export async function answerCard(page: Page, cutsAnswered: number): Promise<string | null> {
  const pick = page.locator('[data-testid="reference-pick"][data-state="waiting"]');
  if (await pick.count()) {
    const candidates = pick.last().locator('[data-testid="pick-candidate"]');
    const n = Math.min(PICK_COUNT, await candidates.count());
    for (let i = 0; i < n; i++) {
      await candidates.nth(i).click();
    }
    await pick.last().locator('[data-testid="pick-go"]').click();
    return `reference pick: first ${n}`;
  }
  const answer = cutAnswerFor(cutsAnswered);
  const cut = page.locator(`[data-testid="${answer}"]`);
  if ((await cut.count()) && (await cut.last().isVisible())) {
    await cut.last().click();
    return `cut review: ${answer}`;
  }
  const brief = page.locator('[data-testid="brief-go"]');
  if ((await brief.count()) && (await brief.last().isVisible())) {
    await brief.last().click();
    return 'script brief: Build it';
  }
  return null;
}

export async function drive(page: Page, agentUrl: string, account: TestAccount | null): Promise<void> {
  const start = Date.now();
  let replies = 0;
  let cutsAnswered = 0;
  let given = AccountGiven.No;
  let before: AgentState | null = null;
  while (Date.now() - start < TURN_CAP_MS) {
    await page.waitForTimeout(POLL_MS);
    const answered = await answerCard(page, cutsAnswered);
    if (answered) {
      say(`  answered ${answered}`);
      cutsAnswered += answered.startsWith('cut review') ? 1 : 0;
      before = null;
      continue;
    }
    const r = await page.request.get(agentUrl);
    const now: AgentState = r.ok() ? await r.json() : { running: true, messages: [] };
    const settled = turnSettled(before, now);
    before = now;
    if (!settled) {
      continue;
    }
    const last = (await page.locator('[role="log"] .prose').allInnerTexts()).at(-1)?.trim() ?? '';
    if (!asksUser(last, given) || replies >= MAX_REPLIES) {
      return;
    }
    const reply = replyTo(last, account);
    given = accountAfter(last, reply, account, given);
    say(`  agent asked, replying: ${reply}`);
    const input = page.locator('#chat-composer-input');
    await input.fill(reply);
    await input.press('Enter');
    replies++;
    before = null;
  }
  throw new Error('turn cap reached');
}

export async function exportMp4(page: Page, file: string): Promise<void> {
  await page.getByRole('status', { name: /^Saved/ }).waitFor({ timeout: 60_000 }).catch(() => {});
  await page.getByTestId('export-open').click();
  await page.getByTestId('export-mode-video').click();
  await page.getByTestId('export-start').click();
  const dl = page.getByTestId('export-download');
  await dl.waitFor({ timeout: EXPORT_TIMEOUT_MS });
  const [ev] = await Promise.all([page.waitForEvent('download'), dl.click()]);
  await ev.saveAs(file);
}
