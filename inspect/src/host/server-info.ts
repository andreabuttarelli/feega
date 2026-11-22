import type { ServerInfo } from '../messages';

type Served = { url: string; framework: string; command: string; pid: number | null; attached: boolean };

type Session = { startedAt: number; lastError: string; keptMinutes: number };

export function commandShown(dev: string[], planned: number): string {
  const at = dev.indexOf(String(planned));
  const kept = at > 0 && dev[at - 1].startsWith('-') ? dev.filter((_, i) => i !== at && i !== at - 1) : dev;
  return kept.join(' ');
}

export const serverInfo = (served: Served, session: Session): ServerInfo => ({ ...session, ...served, port: Number(new URL(served.url).port) });
