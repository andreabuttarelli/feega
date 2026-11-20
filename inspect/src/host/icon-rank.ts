const POPULAR = [
  'heart', 'house', 'home', 'star', 'search', 'user', 'settings', 'check', 'x', 'plus', 'minus', 'menu', 'mail', 'bell',
  'calendar', 'camera', 'trash', 'download', 'upload', 'share', 'lock', 'eye', 'play', 'pause', 'image', 'file', 'folder',
  'globe', 'phone', 'message-circle', 'arrow-right', 'arrow-left', 'chevron-right', 'chevron-down', 'external-link', 'info',
  'circle-check', 'circle-alert', 'shopping-cart', 'credit-card', 'map-pin', 'clock', 'bookmark', 'link', 'copy', 'pencil'
];

const WORD_START = '-';

enum Tier {
  Selected,
  Exact,
  Prefix,
  Word,
  Contains,
  None
}

const byLength = (a: string, b: string) => a.length - b.length || a.localeCompare(b);

function tierOf(name: string, needle: string, current: string | null): Tier {
  if (!name.includes(needle)) {
    return Tier.None;
  }
  if (name === current) {
    return Tier.Selected;
  }
  if (name === needle) {
    return Tier.Exact;
  }
  if (name.startsWith(needle)) {
    return Tier.Prefix;
  }
  return name.includes(WORD_START + needle) ? Tier.Word : Tier.Contains;
}

export function rankNames(names: string[], query: string, current: string | null): string[] {
  const needle = query.trim().toLowerCase();
  const tiers = new Map(names.map((name) => [name, tierOf(name, needle, current)]));
  return names
    .filter((name) => tiers.get(name) !== Tier.None)
    .sort((a, b) => tiers.get(a)! - tiers.get(b)! || byLength(a, b));
}

export function suggestNames(names: string[], current: string | null): string[] {
  const have = new Set(names);
  const family = current ? current.split(WORD_START)[0] : '';
  const mine = current && have.has(current) ? [current] : [];
  const kin = names.filter((name) => family && name !== current && (name === family || name.startsWith(family + WORD_START))).sort(byLength);
  const popular = POPULAR.filter((name) => have.has(name));
  const used = new Set([...mine, ...kin, ...popular]);
  const rest = names.filter((name) => !used.has(name)).sort((a, b) => a.localeCompare(b));
  return [...new Set([...mine, ...kin, ...popular, ...rest])];
}
