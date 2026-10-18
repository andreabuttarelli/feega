import type { ConnectorType } from '../connectors';
import { PORT_SIZE, portsOf, type PortTile } from './geometry';

export type ChromePort = { x: number; y: number; color: string };
export type IdleChrome = { id: string; w: number; h: number; label: string | null; kind: string | null; ports: ChromePort[] };

export function idleChrome(t: PortTile, label: string | null, kind: string | null, colorOf: (port: ConnectorType) => string): IdleChrome {
  const ports = portsOf(t).flatMap((p) => (p.port ? [{ x: p.x - PORT_SIZE / 2 - t.x, y: p.y - PORT_SIZE / 2 - t.y, color: colorOf(p.port) }] : []));
  return { id: t.id, w: t.w, h: t.h, label, kind, ports };
}

export function chromeKey(c: IdleChrome): string {
  return JSON.stringify([c.w, c.h, c.label, c.kind, c.ports]);
}
