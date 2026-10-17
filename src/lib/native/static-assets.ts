import BUNDLED_STATIC from './bundled-static.json';

function bundled(path: string): boolean {
  const first = path.slice(1).split(/[/?#]/)[0];
  return BUNDLED_STATIC.includes(first);
}

function isStaticPath(value: string): boolean {
  return /^\/[^/]/.test(value) && /\.[a-z0-9]{2,5}(\?|#|$)/i.test(value);
}

export function hostedAssets<T>(data: T, hosted: string): T {
  if (typeof data === 'string') {
    return (isStaticPath(data) && !bundled(data) ? `${hosted}${data}` : data) as T;
  }
  if (Array.isArray(data)) {
    return data.map((item) => hostedAssets(item, hosted)) as T;
  }
  if (data && typeof data === 'object') {
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, hostedAssets(v, hosted)])) as T;
  }
  return data;
}
