export const Why = {
  Turbopack: 'turbopack',
  MountError: 'mount_error',
  NoAdapter: 'no_adapter',
  Timeout: 'timeout',
  UnsupportedFramework: 'unsupported_framework'
};

export const Detail = { Provider: 'provider', NotExported: 'not_exported', Load: 'load', Other: 'other' };

const CODES = new Set(Object.values(Why));

const KNOWN = [
  { matches: /does not expose React/i, reason: { reason: Why.Turbopack } },
  { matches: /rendered nothing|did not render the component/i, reason: { reason: Why.Timeout } },
  { matches: /no mount page/i, reason: { reason: Why.NoAdapter } },
  { matches: /not exported/i, reason: { reason: Why.MountError, detail: Detail.NotExported } },
  { matches: /provider|context|must be (used|wrapped) (within|inside)/i, reason: { reason: Why.MountError, detail: Detail.Provider } },
  { matches: /dynamically imported|failed to (fetch|resolve)|import/i, reason: { reason: Why.MountError, detail: Detail.Load } }
];

const OTHER = { reason: Why.MountError, detail: Detail.Other };

export function reasonOf(raw) {
  const text = String(raw ?? '');
  if (CODES.has(text)) {
    return { reason: text };
  }
  return KNOWN.find(({ matches }) => matches.test(text))?.reason ?? OTHER;
}
