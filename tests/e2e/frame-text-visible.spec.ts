import sharp from "sharp";
import type { Page } from "@playwright/test";
import { test, expect, REAL_STACK, gotoHydrated } from "./fixtures/session";
import { pickFrameTool } from "./fixtures/canvas-bar";
import poster from "./fixtures/poster-type-grid.json" with { type: "json" };

const PORTRAIT = {
  format: "4:5",
  docHeadRevision: 1,
  posterAssetId: null,
  lastRenderAssetId: null,
};
const SHOTS = process.env.CANVAS_MOTION_SHOTS;
const CORNER_DOT = {
  id: "dot",
  from: 0,
  durationInFrames: 60,
  component: "Shape",
  trimStart: 0,
  transitionIn: { kind: "none", durationInFrames: 0 },
  transitionOut: { kind: "none", durationInFrames: 0 },
  props: { shape: "rect", x: 0.05, y: 0.05, width: 0.04, height: 0.04 },
};
const BLANK = {
  ...poster,
  fields: [],
  components: {},
  tracks: [{ id: "v1", kind: "visual", name: "Video 1", clips: [CORNER_DOT] }],
};
const CHANNEL_TOLERANCE = 40;
const MIN_INKED_PIXELS = 50;
const RED = "#ff2020";

type Area = { x: number; y: number; width: number; height: number };
type Clip = { id: string; component: string; props: Record<string, unknown> };
type Doc = { tracks: { clips: Clip[] }[] };

async function inked(page: Page, area: Area, name: string): Promise<number> {
  const png = await page.screenshot({
    clip: area,
    path: SHOTS ? `${SHOTS}/${name}.png` : undefined,
  });
  const raw = await sharp(png).removeAlpha().raw().toBuffer();
  const counts = new Map<number, number>();
  for (let i = 0; i < raw.length; i += 3) {
    const key = (raw[i] << 16) | (raw[i + 1] << 8) | raw[i + 2];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const ground = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const channel = [ground >> 16, (ground >> 8) & 255, ground & 255];
  let count = 0;
  for (let i = 0; i < raw.length; i += 3) {
    count += [0, 1, 2].some(
      (c) => Math.abs(raw[i + c] - channel[c]) > CHANNEL_TOLERANCE,
    )
      ? 1
      : 0;
  }
  return count;
}

test.describe("text drawn inside a frame @real", () => {
  test.skip(!REAL_STACK, "richiede uno stack disposable: E2E_REAL_STACK=1");

  test("the text shows in the open editor and on the closed frame, default and recoloured", async ({
    page,
    session,
    admin,
    seedNode,
  }) => {
    test.setTimeout(180_000);
    const node = await seedNode({
      type: "motion",
      x: 80,
      y: 80,
      data: PORTRAIT,
    });
    const { error } = await admin
      .from("motion_revisions")
      .insert({
        org_id: session.orgId,
        node_id: node.id,
        version: 1,
        doc: BLANK,
        actor_kind: "user",
        actor_id: session.userId,
      });
    expect(error).toBeNull();

    const head = async () => {
      const { data } = await admin
        .from("motion_revisions")
        .select("doc, version")
        .eq("node_id", node.id)
        .order("version", { ascending: false })
        .limit(1);
      return data![0] as { doc: Doc; version: number };
    };

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const stage = page.getByTestId("motion-node-stage");
    await stage.click({ position: { x: 60, y: 10 } });
    const overlay = page.getByTestId("selection-overlay");
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    const box = (await overlay.boundingBox())!;
    const at = (fx: number, fy: number) => ({
      x: box.x + box.width * fx,
      y: box.y + box.height * fy,
    });
    const area: Area = {
      x: Math.round(box.x + box.width * 0.2),
      y: Math.round(box.y + box.height * 0.4),
      width: Math.round(box.width * 0.6),
      height: Math.round(box.height * 0.2),
    };

    await expect
      .poll(() => inked(page, area, "text-0-empty"), {
        message: "the empty frame has nothing in the text area",
      })
      .toBeLessThan(MIN_INKED_PIXELS);

    const posterOf = async () =>
      (
        (await admin.from("nodes").select("data").eq("id", node.id).single())
          .data?.data as { posterAssetId?: string | null } | undefined
      )?.posterAssetId ?? null;
    await page.waitForTimeout(4000);
    const blankPoster = await posterOf();
    await pickFrameTool(page, "text");
    const from = at(0.2, 0.4);
    const to = at(0.8, 0.6);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 3 });
    await page.mouse.up();
    await expect
      .poll(
        async () =>
          (await head()).doc.tracks
            .flatMap((t) => t.clips)
            .filter((c) => c.component === "Text").length,
        { timeout: 10_000 },
      )
      .toBe(1);

    await page.keyboard.press("Escape");
    await expect
      .poll(async () => inked(page, area, "text-1-open-default"), {
        message: "default text shows in the open editor",
        timeout: 10_000,
      })
      .toBeGreaterThan(MIN_INKED_PIXELS);

    await expect
      .poll(posterOf, {
        message: "the editor saves a poster with the text",
        timeout: 20_000,
      })
      .not.toBe(blankPoster);
    await page.mouse.click(box.x + box.width + 200, box.y + box.height + 200);
    await page.keyboard.press("Escape");
    await expect
      .poll(async () => inked(page, area, "text-2-closed-default"), {
        message: "default text shows on the closed frame",
        timeout: 20_000,
      })
      .toBeGreaterThan(MIN_INKED_PIXELS);

    const latest = await head();
    const doc = structuredClone(latest.doc);
    const text = doc.tracks
      .flatMap((t) => t.clips)
      .find((c) => c.component === "Text")!;
    text.props = { ...text.props, fills: [{ type: "solid", color: RED }] };
    const recoloured = await admin
      .from("motion_revisions")
      .insert({
        org_id: session.orgId,
        node_id: node.id,
        version: latest.version + 1,
        doc,
        actor_kind: "user",
        actor_id: session.userId,
      });
    expect(recoloured.error).toBeNull();
    await admin
      .from("nodes")
      .update({ data: { ...PORTRAIT, docHeadRevision: latest.version + 1 } })
      .eq("id", node.id);

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(stage).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => inked(page, area, "text-3-closed-red"), {
        message: "recoloured text shows on the closed frame",
        timeout: 20_000,
      })
      .toBeGreaterThan(MIN_INKED_PIXELS);
    await stage.click({ position: { x: 60, y: 10 } });
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");
    await expect
      .poll(async () => inked(page, area, "text-4-open-red"), {
        message: "recoloured text shows in the open editor",
        timeout: 10_000,
      })
      .toBeGreaterThan(MIN_INKED_PIXELS);
  });
});
