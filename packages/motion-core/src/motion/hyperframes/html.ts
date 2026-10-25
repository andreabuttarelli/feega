const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

export function px(n: number): string {
  return `${Math.round(n * 100) / 100}px`;
}

export function seconds(frames: number, fps: number): string {
  return String(Math.round((frames / fps) * 10000) / 10000);
}

export function css(rules: Record<string, string | number | undefined>): string {
  return Object.entries(rules)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${v}`)
    .join(';');
}

export function js(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
