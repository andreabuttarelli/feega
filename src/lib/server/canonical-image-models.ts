export const CANONICAL_IMAGE_WIRE_ID: Readonly<Record<string, string>> = {
  'google/gemini-3.1-flash-image-preview': 'google/gemini-3.1-flash-image',
  'google/gemini-3-pro-image-preview': 'google/gemini-3-pro-image'
};

export function withoutAliases<T extends { id: string }>(rows: Map<string, T>): Map<string, T> {
  const isDuplicate = (id: string) => id in CANONICAL_IMAGE_WIRE_ID && rows.has(CANONICAL_IMAGE_WIRE_ID[id]);
  return new Map([...rows].filter(([id]) => !isDuplicate(id)));
}
