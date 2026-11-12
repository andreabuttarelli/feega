import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

const PAGE_WIDTH = 1280;
const PAGE_PADDING = 48;
const GRID_GAP = 32;

type PageProps = { columns?: number; children: ReactNode };

export function Page({ columns = 3, children }: PageProps) {
  const style: CSSProperties = {
    width: PAGE_WIDTH,
    boxSizing: 'border-box',
    padding: PAGE_PADDING,
    background: 'var(--background)',
    color: 'var(--foreground)',
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: GRID_GAP,
    alignItems: 'start'
  };
  return <main style={style}>{children}</main>;
}

type CellProps = { title: string; span?: number; children: ReactNode; minHeight?: number; position?: 'static' | 'relative' };

export function Cell({ title, span = 1, minHeight, position = 'static', children }: CellProps) {
  const style: CSSProperties = {
    gridColumn: `span ${span}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minWidth: 0,
    minHeight,
    position
  };
  const titleStyle: CSSProperties = {
    margin: 0,
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)'
  };
  return (
    <section style={style}>
      <h2 style={titleStyle}>{title}</h2>
      {children}
    </section>
  );
}

export function Row({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap }}>{children}</div>;
}

export function Stack({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap }}>{children}</div>;
}

const SVG_PALETTES: [string, string][] = [
  ['#6366f1', '#ec4899'],
  ['#0ea5e9', '#22c55e'],
  ['#f59e0b', '#ef4444'],
  ['#14b8a6', '#6366f1'],
  ['#8b5cf6', '#06b6d4']
];

export function artwork(index: number, label = ''): string {
  const [from, to] = SVG_PALETTES[index % SVG_PALETTES.length];
  const text = label
    ? `<text x="50%" y="52%" fill="white" fill-opacity="0.85" font-family="sans-serif" font-size="28" font-weight="600" text-anchor="middle">${label}</text>`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="640" height="400" fill="url(#g)"/><circle cx="500" cy="90" r="120" fill="white" fill-opacity="0.12"/><circle cx="120" cy="340" r="160" fill="white" fill-opacity="0.1"/>${text}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export type TriggerKind = 'click' | 'pointerdown' | 'focus' | 'contextmenu';

const TARGET_SELECTOR = 'button, [aria-haspopup="menu"]';

const DISPATCHERS: Record<TriggerKind, (el: HTMLElement) => void> = {
  click: (el) => el.click(),
  pointerdown: (el) => {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, ctrlKey: false, pointerType: 'mouse' }));
  },
  focus: (el) => el.focus(),
  contextmenu: (el) => {
    const box = el.getBoundingClientRect();
    el.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 })
    );
  }
};

export function AutoTrigger({ kind, children }: { kind: TriggerKind; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = ref.current?.querySelector<HTMLElement>(TARGET_SELECTOR);
      if (target) {
        DISPATCHERS[kind](target);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [kind]);

  return (
    <div ref={ref} style={{ display: 'inline-block' }}>
      {children}
    </div>
  );
}
