import type { Db } from '$lib/server/db/client';
import { logAiCall } from '$lib/server/ai-log';
import { sandboxCostUsd } from '$lib/motion/render-quote';
import { awaitTask, FarmTask, launchCapture, readCapture, TaskState, type CaptureShot, type TaskCheck } from './farm-render';
import { storeImage } from './asset-import';
import type { RenderFarm } from './render-farm';
import type { AssetImport, SiteCapture } from './motion-tools';

export const CAPTURE_LABEL = 'motion_capture';
const CAPTURE_WAIT = { timeoutMs: 6 * 60_000, pollMs: 4_000 };
const PERCENT = /scroll-(\d+)\./;

export type CapturePorts = {
  launch: (url: string) => Promise<string>;
  wait: (name: string, task: FarmTask) => Promise<TaskCheck>;
  read: (name: string) => Promise<CaptureShot[] | null>;
  stop: (name: string) => Promise<void>;
  cost: (name: string) => Promise<number>;
  log: (usd: number) => void;
  store: (bytes: Buffer, label: string) => Promise<AssetImport>;
};

function shotLabel(host: string, name: string): string {
  const percent = Number(PERCENT.exec(name)?.[1] ?? 0);
  return percent ? `${host} · ${percent}% down the page` : `${host} · top of the page`;
}

export async function captureSite(ports: CapturePorts, url: string): Promise<SiteCapture> {
  const name = await ports.launch(url).catch((e: unknown) => (e instanceof Error ? new Error(e.message) : new Error(String(e))));
  if (name instanceof Error) {
    return { ok: false, error: name.message };
  }

  const check = await ports.wait(name, FarmTask.Capture);
  const shots = check.state === TaskState.Done ? await ports.read(name) : null;
  ports.log(await ports.cost(name));
  await ports.stop(name);

  if (check.state !== TaskState.Done) {
    return { ok: false, error: check.error ?? 'the capture failed' };
  }
  if (!shots?.length) {
    return { ok: false, error: 'the page gave no screenshots' };
  }

  const host = new URL(url).hostname;
  const stored = await Promise.all(shots.map((shot) => ports.store(shot.bytes, shotLabel(host, shot.name))));
  return { ok: true, shots: stored.filter((s): s is Extract<AssetImport, { ok: true }> => s.ok) };
}

export type CaptureScope = { orgId: string; projectId: string; canvasId: string; userId: string };

export function farmCapture(db: Db, farm: RenderFarm | null, scope: CaptureScope): ((url: string) => Promise<SiteCapture>) | undefined {
  if (!farm) {
    return undefined;
  }
  return (url) =>
    captureSite(
      {
        launch: (target) => launchCapture(farm, target),
        wait: (name, task) => awaitTask(farm, name, task, CAPTURE_WAIT),
        read: (name) => readCapture(farm, name),
        stop: async (name) => {
          await (await farm.attach(name))?.stop();
        },
        cost: async (name) => {
          const usage = await farm.usage(name);
          return usage ? sandboxCostUsd([usage]) : 0;
        },
        log: (usd) => logAiCall({ label: CAPTURE_LABEL, provider: 'vercel-sandbox', model: 'hyperframes-capture', flatCostUsd: usd, ms: 0, ok: true, orgId: scope.orgId, projectId: scope.projectId, userId: scope.userId, actorKind: 'agent', actorId: scope.userId }),
        store: (bytes, label) => storeImage(db, scope, { bytes, url }, label)
      },
      url
    );
}
