import type { SupabaseClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';
import { dropProject, expect, type E2eSession } from '../../../tests/e2e/fixtures/session';

const AGENT_POST = /\/api\/v1\/projects\/[^/]+\/agent$/;
const HTTP_UNAVAILABLE = 503;
const CANVAS_PATH = /\/p\/([0-9a-f-]{36})\/c\/[0-9a-f-]{36}/;

export async function holdAgent(page: Page): Promise<() => void> {
  let release = () => {};
  const released = new Promise<void>((done) => (release = done));
  await page.route(AGENT_POST, async (route) => {
    if (route.request().method() !== 'POST') {
      return route.fallback();
    }
    await released;
    await route.fulfill({ status: HTTP_UNAVAILABLE, json: { error: 'held by the demo recorder' } }).catch(() => undefined);
  });
  return release;
}

export const projectOf = (url: string): string | null => url.match(CANVAS_PATH)?.[1] ?? null;

export async function dropStarted(admin: SupabaseClient, session: E2eSession, projectId: string | null): Promise<void> {
  if (!projectId || projectId === session.projectId) {
    return;
  }
  await dropProject(admin, session.orgId, projectId);
}

const CANVAS_MS = 120_000;
const SETTLE_MS = 3000;

export async function startedCanvas(page: Page): Promise<void> {
  await page.waitForURL(/\/p\/[^/]+\/c\//, { timeout: CANVAS_MS, waitUntil: 'commit' });
  await expect(page.locator('[data-canvas-surface]')).toBeVisible({ timeout: CANVAS_MS });
  await expect(page.getByTestId('canvas-loading')).toBeHidden({ timeout: CANVAS_MS });
  await expect(page.getByTestId('chat-activity').first()).toBeVisible({ timeout: CANVAS_MS }).catch(() => undefined);
  await page.waitForTimeout(SETTLE_MS);
}
