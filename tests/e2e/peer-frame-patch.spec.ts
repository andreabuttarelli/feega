import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { test, expect, type Page } from "@playwright/test";
import { gotoHydrated, signInE2e } from "./fixtures/session";

const CANVAS = process.env.PEER_CANVAS_PATH;
const DOC_FROM = process.env.PEER_DOC_FROM;
const EMAIL = process.env.E2E_TEST_EMAIL ?? "";
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? "";
const DESKTOP = { width: 1440, height: 900 };
const SAMPLE_MS = 50;
const WATCH_MS = 5000;
const NUDGES = 3;
const SAME_STATE = 6;
const SHOTS = "test-results/peer-frame-patch";
const AT_TOP_RIGHT = { x: 0.8, y: 0.2 };
const AT_BOTTOM_LEFT = { x: 0.1, y: 0.9 };

enum PeerHolds {
  Nothing = "watching",
  Selection = "holding the frame selected",
}

type Sample = { at: number; pixels: Buffer; shot: Buffer };

test.use({
  viewport: DESKTOP,
  actionTimeout: 20_000,
  headless: !process.env.E2E_HEADED,
  launchOptions: {
    args: ["--enable-unsafe-webgpu", "--enable-gpu", "--ignore-gpu-blocklist"],
  },
});

async function seedFrame(projectId: string, canvasId: string) {
  const db = createClient(
    process.env.PUBLIC_SUPABASE_URL!,
    process.env.PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const signed = await db.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (signed.error) {
    throw signed.error;
  }
  const actor = { actor_kind: "user", actor_id: signed.data.user!.id };
  const { data: canvas } = await db
    .from("canvases")
    .select("org_id")
    .eq("id", canvasId)
    .single()
    .throwOnError();
  const { data: source } = await db
    .from("nodes")
    .select("width, height, data")
    .eq("id", DOC_FROM!)
    .single()
    .throwOnError();
  const { data: head } = await db
    .from("motion_revisions")
    .select("doc")
    .eq("node_id", DOC_FROM!)
    .order("version", { ascending: false })
    .limit(1)
    .single()
    .throwOnError();
  const id = randomUUID();
  const data = {
    ...(source!.data as object),
    docHeadRevision: 1,
    posterAssetId: null,
    lastRenderAssetId: null,
  };
  await db
    .from("nodes")
    .insert({
      id,
      org_id: canvas!.org_id,
      project_id: projectId,
      canvas_id: canvasId,
      type: "motion",
      display_name: "Peer probe",
      x: 0,
      y: 0,
      width: source!.width,
      height: source!.height,
      data,
      ...actor,
    })
    .throwOnError();
  await db
    .from("motion_revisions")
    .insert({
      org_id: canvas!.org_id,
      node_id: id,
      version: 1,
      doc: head!.doc,
      summary: "seed",
      ...actor,
    })
    .throwOnError();
  return {
    id,
    remove: () =>
      db
        .from("nodes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id),
  };
}

async function sample(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  started: number,
): Promise<Sample> {
  const shot = await page.screenshot({ clip: box });
  const { data } = await sharp(shot)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { at: Date.now() - started, pixels: data, shot };
}

function distance(a: Buffer, b: Buffer): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum / a.length;
}

const stageOf = (page: Page, id: string) =>
  page.locator(`[data-motion-node="${id}"] [data-frame-stage]`);

test.describe("a teammate frame edit patches in place @real", () => {
  test.skip(
    !CANVAS || !DOC_FROM || !EMAIL,
    "needs PEER_CANVAS_PATH, PEER_DOC_FROM and E2E_TEST_EMAIL/E2E_TEST_PASSWORD",
  );
  test.setTimeout(180_000);

  for (const holds of [PeerHolds.Nothing, PeerHolds.Selection]) {
    test(`a peer ${holds} sees only the before and after states, never a blank frame`, async ({
      page,
      browser,
    }) => {
      const [, projectId, canvasId] = /\/p\/([^/]+)\/c\/([^/?]+)/.exec(
        CANVAS!,
      )!;
      const frame = await seedFrame(projectId, canvasId);
      const elsewhere = await browser.newContext({ viewport: DESKTOP });
      const peer = await elsewhere.newPage();
      try {
        await signInE2e(page, { email: EMAIL, password: PASSWORD });
        await signInE2e(peer, { email: EMAIL, password: PASSWORD });
        await gotoHydrated(page, CANVAS!);
        await gotoHydrated(peer, CANVAS!);
        await expect(stageOf(peer, frame.id)).toHaveAttribute(
          "data-drawn",
          "true",
          { timeout: 60_000 },
        );
        await expect(stageOf(page, frame.id)).toHaveAttribute(
          "data-drawn",
          "true",
          { timeout: 60_000 },
        );
        await peer.waitForTimeout(1500);
        const box = (await stageOf(peer, frame.id).boundingBox())!;
        if (holds === PeerHolds.Selection) {
          await peer.mouse.click(
            box.x + box.width * AT_BOTTOM_LEFT.x,
            box.y + box.height * AT_BOTTOM_LEFT.y,
          );
          await expect(
            peer.locator(`[data-testid="gpu-node"][data-id="${frame.id}"]`),
          ).toHaveClass(/selected/);
          await peer.waitForTimeout(800);
        }
        const fetches: number[] = [];
        peer.on(
          "request",
          (r) =>
            r.url().includes(`/motion/${frame.id}/source`) &&
            fetches.push(Date.now()),
        );

        const own = (await stageOf(page, frame.id).boundingBox())!;
        const element = {
          x: own.x + own.width * AT_TOP_RIGHT.x,
          y: own.y + own.height * AT_TOP_RIGHT.y,
        };
        await page.mouse.click(element.x, element.y);
        await page.waitForTimeout(800);
        await page.mouse.click(element.x, element.y);
        await page.waitForTimeout(800);

        const started = Date.now();
        const samples: Sample[] = [];
        let watching = true;
        const watch = (async () => {
          while (watching) {
            samples.push(await sample(peer, box, started));
            await peer.waitForTimeout(SAMPLE_MS);
          }
        })();
        for (let i = 0; i < NUDGES; i++) {
          await page.keyboard.press("Shift+ArrowRight");
        }
        await peer.waitForTimeout(WATCH_MS);
        watching = false;
        await watch;

        const before = samples[0].pixels;
        const after = samples[samples.length - 1].pixels;
        const strays = samples.filter(
          (s) =>
            Math.min(distance(s.pixels, before), distance(s.pixels, after)) >
            SAME_STATE,
        );
        const visibleAt =
          samples.find(
            (s) =>
              distance(s.pixels, after) <= SAME_STATE &&
              distance(s.pixels, before) > SAME_STATE,
          )?.at ?? null;
        mkdirSync(SHOTS, { recursive: true });
        strays
          .slice(0, 3)
          .forEach((s) => writeFileSync(`${SHOTS}/stray-${s.at}.png`, s.shot));
        console.log(
          JSON.stringify({
            samples: samples.length,
            changed: distance(before, after).toFixed(2),
            visibleAt,
            strays: strays.map((s) => s.at),
            sourceFetches: fetches.map((t) => t - started),
          }),
        );

        expect(distance(before, after)).toBeGreaterThan(SAME_STATE);
        expect(strays.map((s) => s.at)).toEqual([]);
          if (holds === PeerHolds.Selection) {
          await expect(
            peer.locator(`[data-testid="gpu-node"][data-id="${frame.id}"]`),
          ).toHaveClass(/selected/);
        }
      } finally {
        await frame.remove();
        await elsewhere.close();
      }
    });
  }
});
