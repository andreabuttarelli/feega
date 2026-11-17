const docJson = new WeakMap<object, string>();

export function jsonOfDoc(doc: unknown): string {
  if (!doc || typeof doc !== 'object') {
    return JSON.stringify(doc ?? null);
  }
  const known = docJson.get(doc);
  if (known !== undefined) {
    return known;
  }
  const json = JSON.stringify(doc);
  docJson.set(doc, json);
  return json;
}
