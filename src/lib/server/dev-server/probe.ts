export const COMMON_PORTS = [3000, 3001, 5173, 5174, 4321, 4200, 8080, 8000];

const PROBE_TIMEOUT_MS = 800;

export function candidateUrls(options: { configured?: string; self?: number; ports?: readonly number[] }): string[] {
  const ports = (options.ports ?? COMMON_PORTS).filter((p) => p !== options.self);
  const probed = ports.map((p) => `http://localhost:${p}`);
  return options.configured ? [options.configured, ...probed.filter((u) => u !== options.configured)] : probed;
}

export async function findRunning(urls: readonly string[], reach: (url: string) => Promise<boolean>): Promise<string | null> {
  const answers = await Promise.all(urls.map(reach));
  return urls[answers.indexOf(true)] ?? null;
}

export async function answers(url: string): Promise<boolean> {
  try {
    await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    return true;
  } catch {
    return false;
  }
}

export async function servesFolder(url: string, folder: string, cwdOf: (port: number) => Promise<string | null>): Promise<boolean> {
  const cwd = await cwdOf(Number(new URL(url).port));
  return cwd !== null && (cwd === folder || cwd.startsWith(`${folder}/`));
}
