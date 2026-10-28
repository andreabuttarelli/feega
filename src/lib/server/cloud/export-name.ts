const UPLOAD_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/;
const FALLBACK_NAME = 'export';

export function exportName(storagePath: string): string {
  const last = storagePath.split('/').pop() ?? '';
  return last.replace(UPLOAD_PREFIX, '') || FALLBACK_NAME;
}
