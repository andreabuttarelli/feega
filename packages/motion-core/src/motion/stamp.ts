export function contentStamp(content: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash = Math.imul(hash ^ content.charCodeAt(i), 0x01000193);
  }
  return `${(hash >>> 0).toString(36)}-${content.length.toString(36)}`;
}
