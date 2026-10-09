import { randomUUID } from 'node:crypto';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

test.setTimeout(90_000);

const SHOTS = process.env.DASHBOARD_SHOTS_DIR;

const VIDEOS = [
  { name: 'northwind launch film', format: '16:9', seed: 'northwind', project: 0 },
  { name: 'lumen app teaser', format: '9:16', seed: 'lumen', project: 1 },
  { name: 'atlas pricing reveal', format: '16:9', seed: 'atlas', project: 0 },
  { name: 'orbit logo sting', format: '1:1', seed: 'orbit', project: 2 },
  { name: 'kite onboarding', format: '4:5', seed: 'kite', project: 1 },
  { name: 'meridian keynote opener', format: '16:9', seed: 'meridian', project: 2 },
  { name: 'pulse feature drop', format: '9:16', seed: 'pulse', project: 0 }
];

const PROJECTS = ['Northwind', 'Lumen', 'Orbit studio'];

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 }
];

for (const scheme of ['light', 'dark'] as const) {
  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.name} ${scheme}`, () => {
      test.use({ viewport, colorScheme: scheme });

      test('hero first, the videos grid peeks under it, projects after', async ({ page, session, admin }) => {
        const projectIds = [session.projectId, randomUUID(), randomUUID()];
        await admin.from('projects').update({ name: PROJECTS[0] }).eq('id', session.projectId);
        for (const [i, id] of projectIds.slice(1).entries()) {
          await admin.from('projects').insert({ id, org_id: session.orgId, name: PROJECTS[i + 1], slug: `e2e-${id}` });
        }
        const canvasIds = [session.canvasId];
        for (const id of projectIds.slice(1)) {
          const canvas = randomUUID();
          await admin.from('canvases').insert({ id: canvas, org_id: session.orgId, project_id: id, name: 'Motion' });
          canvasIds.push(canvas);
        }

        for (const [i, video] of VIDEOS.entries()) {
          const poster = await admin
            .from('assets')
            .insert({ org_id: session.orgId, project_id: projectIds[video.project], type: 'image', source: 'upload', url: `https://picsum.photos/seed/${video.seed}/960/540`, mime_type: 'image/jpeg' })
            .select('id')
            .single();
          const node = await admin.from('nodes').insert({
            org_id: session.orgId,
            project_id: projectIds[video.project],
            canvas_id: canvasIds[video.project],
            type: 'motion',
            display_name: video.name,
            x: i * 500,
            y: 0,
            data: { format: video.format, docHeadRevision: 0, posterAssetId: poster.data!.id, lastRenderAssetId: null },
            updated_at: new Date(Date.now() - i * 7 * 3600_000).toISOString(),
            actor_kind: 'user',
            actor_id: session.userId
          });
          expect(node.error).toBeNull();
        }

        await gotoHydrated(page, '/app');

        await expect(page.getByTestId('home-hero')).toBeVisible();
        await expect(page.getByTestId('home-peek')).toBeInViewport();
        await expect(page.getByTestId('video-card')).toHaveCount(VIDEOS.length);
        await expect(page.getByTestId('project-card')).toHaveCount(PROJECTS.length);

        if (!SHOTS) {
          return;
        }
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SHOTS}/${viewport.name}-${scheme}-fold.png` });
        await page.screenshot({ path: `${SHOTS}/${viewport.name}-${scheme}-full.png`, fullPage: true });
      });
    });
  }
}
