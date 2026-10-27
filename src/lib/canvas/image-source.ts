const idOf = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

export function sourceAssetIdOf(data: Record<string, unknown>): string | null {
  return idOf(data.refId) ?? idOf(data.assetId);
}
