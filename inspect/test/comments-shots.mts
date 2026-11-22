import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CloudComment } from '../src/host/cloud-api.ts';
import type { CommentsCloud } from '../src/host/comments.ts';
import { openPanel } from './harness.mts';

const SHOTS = process.env.SHOTS_DIR!;
const SESSION = 's1';
mkdirSync(SHOTS, { recursive: true });

const stored: CloudComment[] = [];
let session: string | null = SESSION;
const cloud: CommentsCloud = {
  sessionId: () => session,
  api: {
    comments: async () => [...stored],
    addComment: async (id, draft) => {
      const made: CloudComment = { id: `c${stored.length + 1}`, sessionId: id, authorId: 'u1', authorName: 'Ada', parentId: null, createdAt: new Date(Date.now() + stored.length * 1000).toISOString(), resolvedAt: null, resolvedBy: null, ...draft, parentId: draft.parentId ?? null };
      stored.push(made);
      return made;
    },
    resolve: async (_id, commentId) => {
      const found = stored.find((c) => c.id === commentId)!;
      found.resolvedAt = new Date().toISOString();
      return found;
    }
  }
};

const panel = await openPanel(process.env.INSPECT_APP_ROOT!, undefined, cloud);
const { page } = panel;
const pins = () => page.locator('[data-testid=comment-pin]');

await panel.pickAt('.lead');
await page.waitForTimeout(300);
await page.locator('[data-testid=comment-start]').click();
await page.locator('[data-testid=comment-input]').fill('Tighter line height here');
await page.screenshot({ path: join(SHOTS, '1-composer.png') });
await page.locator('[data-testid=comment-send]').click();

await pins().first().waitFor({ timeout: 10_000 });
assert.equal(await pins().count(), 1, 'one pin on the commented element');
assert.equal(stored[0].sourceFile.endsWith('+page.svelte'), true, 'the comment carries the source file');
assert.match(await page.locator('[data-testid=comments-tab]').innerText(), /Comments 1/);
await page.screenshot({ path: join(SHOTS, '2-pin-and-list.png') });

await page.locator('[data-testid=comment-reply]').click();
await page.locator('[data-testid=reply-input]').fill('Agreed, 1.5 works');
await page.locator('[data-testid=reply-send]').click();
await page.locator('.reply').first().waitFor({ timeout: 10_000 });
await page.screenshot({ path: join(SHOTS, '3-reply.png') });

await page.locator('[data-testid=comment-resolve]').click();
await page.waitForFunction(() => document.querySelectorAll('[data-testid=comment-pin]').length === 0, null, { timeout: 10_000 });
assert.equal(await pins().count(), 0, 'a resolved comment loses its pin');
await page.locator('[data-testid=comments-resolved-toggle]').click();
assert.equal(await page.locator('[data-testid=comment-thread]').count(), 1, 'resolved threads come back on request');
await page.screenshot({ path: join(SHOTS, '4-resolved.png') });

await panel.pickAt('.title');
await page.keyboard.press('c');
await page.locator('[data-testid=comment-composer]').waitFor();
assert.ok(await page.locator('[data-testid=comment-input]').isVisible(), 'C opens the composer on the selection');

session = null;
await page.evaluate(() => window.postMessage({ kind: 'comments', enabled: false, comments: [] }, '*'));
await page.locator('[data-testid=comments-hint]').waitFor();
await page.screenshot({ path: join(SHOTS, '5-no-session.png') });

console.log('comments: ok');
await panel.close();
process.exit(0);
