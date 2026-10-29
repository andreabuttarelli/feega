export type PropValue = string | number | boolean;

export type ComponentUse = { component: string; props: Record<string, PropValue> };

export type MarkLimits = { uses: number; text: number };

export const MARK_LIMITS: MarkLimits = { uses: 600, text: 200 };

export type MarkAsk = { names: string[]; limits: MarkLimits; attr: string };

export function componentMarksOf({ names, limits, attr }: MarkAsk): ComponentUse[] {
  const known = new Set(names);
  const HOST = 5;
  const COMPOSITE = new Set([0, 1, 11, 14, 15]);
  const uses: ComponentUse[] = [];
  const roots = new Map<object, Element[]>();

  type Fiber = { tag: number; type: unknown; memoizedProps: Record<string, unknown> | null; return: Fiber | null; alternate: Fiber | null };

  const fiberOf = (el: Element): Fiber | null => {
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
    return key ? ((el as unknown as Record<string, Fiber>)[key] ?? null) : null;
  };

  const nameOf = (type: unknown): string | null => {
    if (typeof type === 'function') {
      const fn = type as { displayName?: string; name?: string };
      return fn.displayName || fn.name || null;
    }
    if (type && typeof type === 'object') {
      const wrapped = type as { displayName?: string; render?: unknown; type?: unknown };
      return wrapped.displayName || nameOf(wrapped.render) || nameOf(wrapped.type);
    }
    return null;
  };

  const identity = (fiber: Fiber): object => (fiber.alternate && roots.has(fiber.alternate) ? fiber.alternate : fiber);

  const propsOf = (raw: Record<string, unknown> | null): Record<string, PropValue> => {
    const out: Record<string, PropValue> = {};
    for (const [key, value] of Object.entries(raw ?? {})) {
      if (typeof value === 'boolean' || typeof value === 'number') {
        out[key] = value;
      }
      if (typeof value === 'string') {
        out[key] = value.slice(0, limits.text);
      }
    }
    return out;
  };

  const owners = (host: Fiber): Fiber[] => {
    const found: Fiber[] = [];
    for (let f = host.return; f && f.tag !== HOST; f = f.return) {
      const name = COMPOSITE.has(f.tag) ? nameOf(f.type) : null;
      if (name && known.has(name)) {
        found.push(f);
      }
    }
    return found;
  };

  for (const el of document.body?.querySelectorAll('*') ?? []) {
    const fiber = fiberOf(el);
    if (!fiber || fiber.tag !== HOST) {
      continue;
    }
    for (const owner of owners(fiber)) {
      const id = identity(owner);
      roots.set(id, [...(roots.get(id) ?? []), el]);
    }
  }

  const single = new Map<Element, Fiber[]>();
  for (const [fiber, els] of roots) {
    if (els.length === 1) {
      single.set(els[0], [...(single.get(els[0]) ?? []), fiber as Fiber]);
    }
  }

  for (const [el, fibers] of single) {
    if (uses.length >= limits.uses) {
      break;
    }
    const outermost = fibers.at(-1)!;
    el.setAttribute(attr, String(uses.length));
    uses.push({ component: nameOf(outermost.type)!, props: propsOf(outermost.memoizedProps) });
  }
  return uses;
}
