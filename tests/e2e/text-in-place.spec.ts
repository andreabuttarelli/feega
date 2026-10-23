import { test, expect, REAL_STACK, gotoHydrated } from "./fixtures/session";
import type { Locator, Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

const LANDSCAPE = {
  format: "16:9",
  docHeadRevision: 1,
  posterAssetId: null,
  lastRenderAssetId: null,
};

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: "brand",
  still: { frame: 0 },
  tracks: [
    {
      id: "v1",
      kind: "visual",
      name: "Video 1",
      clips: [
        {
          id: "tx",
          from: 0,
          durationInFrames: 150,
          component: "Text",
          transform: { rotateZ: 12 },
          props: {
            text: "Hello",
            x: 0.5,
            y: 0.5,
            width: 0.6,
            height: 0.3,
            size: 0.12,
            color: "#ff3366",
            weight: 700,
          },
        },
      ],
    },
  ],
  comps: {},
  assets: [],
};

async function headText(
  admin: SupabaseClient,
  nodeId: string,
): Promise<string> {
  const { data } = await admin
    .from("motion_revisions")
    .select("doc")
    .eq("node_id", nodeId)
    .order("version", { ascending: false })
    .limit(1);
  const head = data?.[0]?.doc as typeof doc | undefined;
  return String(head?.tracks[0].clips[0].props.text ?? "");
}

const EDITOR = "core-text-edit";

const hostOf = (page: Page, nodeId: string) =>
  page.locator(`[data-testid="frame-overlays"] [data-frame="${nodeId}"]`);

async function centreOf(locator: Locator) {
  await expect(locator).toBeVisible({ timeout: 30_000 });
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe("text edited where it is drawn on the gpu canvas @real", () => {
  test.skip(!REAL_STACK, "richiede uno stack disposable: E2E_REAL_STACK=1");

  test("double-click puts the caret in the drawn text, typing updates it live, Esc saves", async ({
    page,
    session,
    admin,
    seedNode,
  }) => {
    test.setTimeout(120_000);
    const frame = await seedNode({
      type: "motion",
      x: 80,
      y: 80,
      data: LANDSCAPE,
    });
    const { error } = await admin
      .from("motion_revisions")
      .insert({
        org_id: session.orgId,
        node_id: frame.id,
        version: 1,
        doc,
        actor_kind: "user",
        actor_id: session.userId,
      });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const middle = await centreOf(hostOf(page, frame.id));
    await expect(async () => {
      await page.mouse.dblclick(middle.x, middle.y);
      await expect(page.getByTestId(EDITOR)).toBeVisible({ timeout: 1500 });
    }, "the drawn text takes the caret once the frame has painted").toPass({
      timeout: 25_000,
    });

    const field = page.getByTestId(EDITOR);
    await expect(field).toHaveValue("Hello");
    await page.keyboard.press("End");
    await page.keyboard.type(" there");
    await expect(field).toHaveValue("Hello there");
    await page.keyboard.press("Escape");
    await expect(field).toHaveCount(0);

    await expect
      .poll(() => headText(admin, frame.id), { timeout: 15_000 })
      .toBe("Hello there");
    await page.keyboard.press("ControlOrMeta+z");
    await expect
      .poll(() => headText(admin, frame.id), { timeout: 15_000 })
      .toBe("Hello");
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect
      .poll(() => headText(admin, frame.id), { timeout: 15_000 })
      .toBe("Hello there");

    await page.reload();
    const again = await centreOf(hostOf(page, frame.id));
    await expect(async () => {
      await page.mouse.dblclick(again.x, again.y);
      await expect(page.getByTestId(EDITOR)).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 25_000 });
    await expect(page.getByTestId(EDITOR)).toHaveValue("Hello there");
  });

  test("a free text on the canvas edits in place on double-click", async ({
    page,
    session,
    admin,
    seedNode,
  }) => {
    test.setTimeout(120_000);
    const free = await seedNode({
      type: "motion",
      x: 120,
      y: 120,
      data: { ...LANDSCAPE, kind: "element" },
    });
    await admin
      .from("nodes")
      .update({ width: 600, height: 200 })
      .eq("id", free.id);
    const sheet = {
      ...doc,
      width: 600,
      height: 200,
      background: "transparent",
      tracks: [
        {
          ...doc.tracks[0],
          clips: [
            {
              ...doc.tracks[0].clips[0],
              transform: {},
              props: {
                ...doc.tracks[0].clips[0].props,
                x: 0.5,
                y: 0.5,
                width: 1,
                height: 1,
                size: 0.3,
              },
            },
          ],
        },
      ],
    };
    const { error } = await admin
      .from("motion_revisions")
      .insert({
        org_id: session.orgId,
        node_id: free.id,
        version: 1,
        doc: sheet,
        actor_kind: "user",
        actor_id: session.userId,
      });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const middle = await centreOf(
      page.locator(`[data-motion-node="${free.id}"]`).first(),
    );
    await expect(async () => {
      await page.mouse.dblclick(middle.x, middle.y);
      await expect(page.getByTestId(EDITOR)).toBeVisible({ timeout: 1500 });
    }, "the free text takes the caret once drawn").toPass({ timeout: 25_000 });

    await page.keyboard.press("End");
    await page.keyboard.type("!");
    await page.mouse.click(5, 5);
    await expect
      .poll(() => headText(admin, free.id), { timeout: 15_000 })
      .toBe("Hello!");
  });
});
