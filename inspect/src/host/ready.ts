import type { Failed } from './dev-output';

export type Watched = { url: string | null; failed: Failed | null };

export type Probes = {
  listening: (port: number) => Promise<boolean>;
  ours: (port: number) => Promise<boolean>;
  wait: () => Promise<void>;
  now: () => number;
  timeoutMs: number;
};

const HOST = '127.0.0.1';

export const portOf = (url: string) => Number(new URL(url).port) || 80;

export async function until(port: number, child: { exitCode: number | null }, seen: Watched, probes: Probes): Promise<string | Failed | null> {
  const end = probes.now() + probes.timeoutMs;
  while (probes.now() < end && child.exitCode === null && !seen.failed) {
    const printed = seen.url;
    if (printed && (await probes.listening(portOf(printed)))) {
      return printed;
    }
    if (await probes.ours(port)) {
      return `http://${HOST}:${port}/`;
    }
    await probes.wait();
  }
  return seen.failed;
}
