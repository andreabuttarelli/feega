const HASH_KEY = '#feega-mount=';

export function pageMountUrl({ pathname, search }, request) {
  return `${pathname}${search}${HASH_KEY}${encodeURIComponent(JSON.stringify(request))}`;
}

export function requestOfHash(hash) {
  if (!hash.startsWith(HASH_KEY)) {
    return null;
  }
  try {
    return JSON.parse(decodeURIComponent(hash.slice(HASH_KEY.length)));
  } catch {
    return null;
  }
}
