export type SwitcherBrand = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  scheduled: number;
  accounts: number;
  accountsDown: number;
};

export enum BrandSection {
  Pinned = 'pinned',
  Project = 'project',
  All = 'all'
}

export enum BrandHealth {
  Reconnect = 'reconnect',
  Scheduled = 'scheduled',
  Idle = 'idle',
  Unconnected = 'unconnected'
}

export type BrandStatus = Pick<SwitcherBrand, 'scheduled' | 'accounts' | 'accountsDown'>;

const CONNECTED = 'connected';
const READY = 'ready';

const HEALTH_RULES: Array<[BrandHealth, (b: BrandStatus) => boolean]> = [
  [BrandHealth.Reconnect, (b) => b.accountsDown > 0],
  [BrandHealth.Unconnected, (b) => b.accounts === 0],
  [BrandHealth.Scheduled, (b) => b.scheduled > 0],
  [BrandHealth.Idle, () => true]
];

export function brandHealth(brand: BrandStatus): BrandHealth {
  return HEALTH_RULES.find(([, holds]) => holds(brand))![0];
}

function matches(brand: SwitcherBrand, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return !needle || brand.name.toLowerCase().includes(needle) || brand.slug.toLowerCase().includes(needle);
}

export function brandSections(
  brands: SwitcherBrand[],
  view: { query: string; pinned: string[]; projectBrandId: string | null }
): Array<{ key: BrandSection; brands: SwitcherBrand[] }> {
  const visible = brands.filter((b) => matches(b, view.query));
  const byId = new Map(visible.map((b) => [b.id, b]));

  const pinned = view.pinned.map((id) => byId.get(id)).filter((b): b is SwitcherBrand => Boolean(b));
  const pinnedIds = new Set(pinned.map((b) => b.id));
  const project = visible.filter((b) => b.id === view.projectBrandId && !pinnedIds.has(b.id));
  const rest = visible
    .filter((b) => !pinnedIds.has(b.id) && b.id !== view.projectBrandId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const sections = [
    { key: BrandSection.Pinned, brands: pinned },
    { key: BrandSection.Project, brands: project },
    { key: BrandSection.All, brands: rest }
  ];
  return sections.filter((s) => s.brands.length > 0);
}

export function togglePin(pinned: string[], brandId: string): string[] {
  return pinned.includes(brandId) ? pinned.filter((id) => id !== brandId) : [...pinned, brandId];
}

type PostRow = { brand_id: string; status: string; planned_for: string | null };
type AccountRow = { brand_id: string | null; status: string };

export function tallyBrandStatus(rows: { posts: PostRow[]; accounts: AccountRow[] }, now: Date): Map<string, BrandStatus> {
  const tally = new Map<string, BrandStatus>();
  const of = (id: string) => {
    const found = tally.get(id) ?? { scheduled: 0, accounts: 0, accountsDown: 0 };
    tally.set(id, found);
    return found;
  };

  for (const post of rows.posts) {
    if (post.status !== READY || !post.planned_for || new Date(post.planned_for) <= now) {
      continue;
    }
    of(post.brand_id).scheduled += 1;
  }

  for (const account of rows.accounts) {
    if (!account.brand_id) {
      continue;
    }
    const status = of(account.brand_id);
    status.accounts += 1;
    status.accountsDown += account.status === CONNECTED ? 0 : 1;
  }

  return tally;
}
