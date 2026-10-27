const HOSTS = new Set(['figma.com', 'www.figma.com']);
const FILE_PATH = /^\/(?:design|file|board|proto)\/([A-Za-z0-9_-]{6,64})(?:\/|$)/;

export type FigmaLink = { fileKey: string; nodeId: string | null };

export function figmaUrl(text: string): FigmaLink | null {
  const url = URL.parse(text.trim());
  if (!url || url.protocol !== 'https:' || !HOSTS.has(url.hostname)) {
    return null;
  }

  const fileKey = FILE_PATH.exec(url.pathname)?.[1];
  if (!fileKey) {
    return null;
  }

  const node = url.searchParams.get('node-id');
  return { fileKey, nodeId: node ? node.replace('-', ':') : null };
}
