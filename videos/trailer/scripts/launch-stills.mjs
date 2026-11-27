import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import path from "node:path";

const [outDir, ...frames] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: process.env.COMP ?? "Launch" });

for (const frame of frames.map(Number)) {
  await renderStill({ serveUrl, composition, frame, output: path.join(outDir, `f${frame}.png`) });
  console.log(`f${frame}`);
}
