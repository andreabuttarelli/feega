import { test, expect, REAL_STACK, gotoHydrated } from "./fixtures/session";
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

for (const [renderer, query] of [
  ["gpu", ""],
  ["dom", "?renderer=dom"],
]) {
  test.describe(`text edited where it is drawn on the ${renderer} canvas @real`, () => {
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

      await gotoHydrated(
        page,
        `/p/${session.projectId}/c/${session.canvasId}${query}`,
      );
      await page
        .locator(`[data-motion-node="${frame.id}"] [data-frame-stage]`)
        .click({ position: { x: 4, y: 4 } });
      const overlay = page.getByTestId("selection-overlay");
      await expect(overlay).toBeVisible({ timeout: 15_000 });

      const inside = page
        .frameLocator('[data-testid="motion-preview"] iframe')
        .first();
      const drawn = inside.locator('[id="tx-tx"]');
      await expect(drawn).toBeVisible({ timeout: 15_000 });
      const rect = () =>
        drawn.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y };
        });
      const before = await rect();
      const style = await drawn.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          font: s.fontFamily,
          size: s.fontSize,
          weight: s.fontWeight,
          color: s.color,
        };
      });

      const stage = (await page
        .getByTestId("motion-preview")
        .first()
        .boundingBox())!;
      await page.mouse.dblclick(
        stage.x + stage.width / 2,
        stage.y + stage.height / 2,
      );
      await expect(drawn).toHaveAttribute(
        "contenteditable",
        /plaintext-only|true/,
      );
      await expect(page.getByTestId("part-edit")).toHaveCount(0);

      const editing = await rect();
      expect(Math.abs(editing.x - before.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(editing.y - before.y)).toBeLessThanOrEqual(1);
      expect(await drawn.evaluate((el) => getComputedStyle(el).fontSize)).toBe(
        style.size,
      );
      expect(await drawn.evaluate((el) => getComputedStyle(el).color)).toBe(
        style.color,
      );

      await page.keyboard.press("End");
      await page.keyboard.type(" there");
      await expect(drawn).toHaveText("Hello there");
      await page.keyboard.press("Escape");

      await expect
        .poll(() => headText(admin, frame.id), { timeout: 15_000 })
        .toBe("Hello there");
      await page.keyboard.press("ControlOrMeta+z");
      await expect(drawn).toHaveText("Hello", { timeout: 10_000 });
      await page.keyboard.press("ControlOrMeta+Shift+z");
      await expect(drawn).toHaveText("Hello there", { timeout: 10_000 });
      await expect
        .poll(() => headText(admin, frame.id), { timeout: 15_000 })
        .toBe("Hello there");
      await page.reload();
      await page
        .locator(`[data-motion-node="${frame.id}"] [data-frame-stage]`)
        .first()
        .click({ position: { x: 4, y: 4 } });
      await expect(
        page
          .frameLocator('[data-testid="motion-preview"] iframe')
          .first()
          .locator('[id="tx-tx"]'),
      ).toHaveText("Hello there", { timeout: 15_000 });
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

      await gotoHydrated(
        page,
        `/p/${session.projectId}/c/${session.canvasId}${query}`,
      );
      const tile = (await page
        .locator(`[data-motion-node="${free.id}"]`)
        .first()
        .boundingBox())!;
      await page.mouse.dblclick(
        tile.x + tile.width / 2,
        tile.y + tile.height / 2,
      );
      const drawn = page
        .frameLocator('[data-testid="motion-preview"] iframe')
        .first()
        .locator('[id="tx-tx"]');
      await expect(drawn).toHaveAttribute(
        "contenteditable",
        /plaintext-only|true/,
        { timeout: 10_000 },
      );
      await page.keyboard.press("End");
      await page.keyboard.type("!");
      await page.mouse.click(5, 5);
      await expect
        .poll(() => headText(admin, free.id), { timeout: 15_000 })
        .toBe("Hello!");
    });
  });
}
