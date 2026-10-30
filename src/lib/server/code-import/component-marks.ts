export type PropValue = string | number | boolean;

export type ComponentUse = { component: string; props: Record<string, PropValue>; shares?: number };

export type MarkLimits = { uses: number; text: number };

export const MARK_LIMITS: MarkLimits = { uses: 600, text: 200 };

export type MarkAsk = { names: string[]; limits: MarkLimits; attr: string };

export function componentMarksOf({ names, limits, attr }: MarkAsk): ComponentUse[] {
  const known = new Set(names);
  const HOSTS = new Set([5, 26, 27]);
  const COMPOSITE = new Set([0, 1, 11, 14, 15]);
  const VENDOR = /(^|\/)(node_modules|\.svelte-kit)\//;
  const uses: ComponentUse[] = [];

  type Owner = { id: object; name: string; props: Record<string, unknown> | null };
  type Fiber = { tag: number; type: unknown; memoizedProps: Record<string, unknown> | null; return: Fiber | null; alternate: Fiber | null; _debugInfo?: unknown[] };
  type Docgen = { __docgenInfo?: { displayName?: string } };
  type VueInstance = { type: { name?: string; __name?: string; __file?: string } & Docgen; props: Record<string, unknown> | null; parent: VueInstance | null; subTree?: { el?: unknown } };
  type SvelteEntry = { type: string; file?: string; componentTag?: string; parent: SvelteEntry | null };
  type SvelteMeta = { parent: SvelteEntry | null; loc?: { file?: string } };

  const canonical = new Set<object>();

  const fiberOf = (el: Element): Fiber | null => {
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
    return key ? ((el as unknown as Record<string, Fiber>)[key] ?? null) : null;
  };

  const docgenName = (type: unknown): string | null => (type && (typeof type === 'function' || typeof type === 'object') ? ((type as Docgen).__docgenInfo?.displayName ?? null) : null);

  const nameOf = (type: unknown): string | null => {
    if (typeof type === 'function') {
      const fn = type as { displayName?: string; name?: string };
      return docgenName(type) || fn.displayName || fn.name || null;
    }
    if (type && typeof type === 'object') {
      const wrapped = type as { displayName?: string; render?: unknown; type?: unknown };
      return docgenName(type) || wrapped.displayName || nameOf(wrapped.render) || nameOf(wrapped.type);
    }
    return null;
  };

  const codeName = (type: unknown): string | null => {
    const wrapped = type as { render?: unknown; type?: unknown } | null;
    const documented = docgenName(type) ?? docgenName(wrapped?.render) ?? docgenName(wrapped?.type);
    const name = documented ?? nameOf(type);
    const last = name?.split('.').pop() ?? '';
    if (documented || !name) {
      return documented;
    }
    return known.has(name) ? name : known.has(last) ? last : null;
  };

  const identity = (fiber: Fiber): object => {
    if (fiber.alternate && canonical.has(fiber.alternate)) {
      return fiber.alternate;
    }
    canonical.add(fiber);
    return fiber;
  };

  const serverOwners = (fiber: Fiber): Owner[] =>
    [...(fiber._debugInfo ?? [])].reverse().flatMap((info) => {
      const entry = info as { name?: unknown; props?: Record<string, unknown> } | null;
      return entry && typeof entry.name === 'string' && known.has(entry.name) ? [{ id: entry as object, name: entry.name, props: entry.props ?? null }] : [];
    });

  const reactOwners = (el: Element): Owner[] | null => {
    const host = fiberOf(el);
    if (!host || !HOSTS.has(host.tag)) {
      return null;
    }
    const found = serverOwners(host);
    for (let f = host.return; f && !HOSTS.has(f.tag); f = f.return) {
      const name = COMPOSITE.has(f.tag) ? codeName(f.type) : null;
      if (name) {
        found.push({ id: identity(f), name, props: f.memoizedProps });
      }
      found.push(...serverOwners(f));
    }
    return found;
  };

  const vueName = (i: VueInstance): string | null => i.type.__docgenInfo?.displayName || i.type.name || i.type.__name || i.type.__file?.split('/').pop()?.replace(/\.vue$/, '') || null;

  const vueOwnedByCode = (i: VueInstance, name: string): boolean => known.has(name) || Boolean(i.type.__docgenInfo) || Boolean(i.type.__file && !VENDOR.test(i.type.__file));

  const vueOwners = (el: Element): Owner[] | null => {
    const owner = (el as unknown as { __vueParentComponent?: VueInstance }).__vueParentComponent;
    if (!owner) {
      return null;
    }
    const found: Owner[] = [];
    for (let i: VueInstance | null = owner; i && i.subTree?.el === el; i = i.parent) {
      const name = vueName(i);
      if (name && vueOwnedByCode(i, name)) {
        found.push({ id: i, name, props: i.props });
      }
    }
    return found;
  };

  const svelteMetaOf = (el: Element | null): SvelteMeta | null => (el ? ((el as unknown as { __svelte_meta?: SvelteMeta | null }).__svelte_meta ?? null) : null);

  const svelteEntries = (meta: SvelteMeta | null): SvelteEntry[] => {
    const out: SvelteEntry[] = [];
    for (let e = meta?.parent ?? null; e; e = e.parent) {
      if (e.type === 'component') {
        out.push(e);
      }
    }
    return out;
  };

  const svelteOwners = (el: Element): Owner[] | null => {
    const meta = svelteMetaOf(el);
    if (!meta) {
      return null;
    }
    const outside = new Set(svelteEntries(svelteMetaOf(el.parentElement)));
    const found: Owner[] = [];
    let defined = meta.loc?.file ?? '';
    for (const entry of svelteEntries(meta)) {
      if (outside.has(entry)) {
        break;
      }
      const name = entry.componentTag;
      if (name && (known.has(name) || !(VENDOR.test(defined) || VENDOR.test(entry.file ?? '')))) {
        found.push({ id: entry, name, props: null });
      }
      defined = entry.file ?? '';
    }
    return found;
  };

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

  const rooted = new Map<Element, Owner[]>();
  const roots = new Map<object, number>();
  for (const el of document.body?.querySelectorAll('*') ?? []) {
    const owners = reactOwners(el) ?? vueOwners(el) ?? svelteOwners(el) ?? [];
    if (!owners.length) {
      continue;
    }
    rooted.set(el, owners);
    for (const owner of owners) {
      roots.set(owner.id, (roots.get(owner.id) ?? 0) + 1);
    }
  }

  for (const [el, owners] of rooted) {
    const single = owners.filter((o) => roots.get(o.id) === 1).reverse();
    if (!single.length) {
      continue;
    }
    if (uses.length + single.length > limits.uses) {
      break;
    }
    el.setAttribute(attr, String(uses.length));
    single.forEach((owner, depth) => uses.push({ component: owner.name, props: propsOf(owner.props), ...(depth ? { shares: uses.length - 1 } : {}) }));
  }
  return uses;
}
