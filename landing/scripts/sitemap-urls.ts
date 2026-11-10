const LOC = /<loc>([^<]+)<\/loc>/g;

export function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(LOC)].map((match) => match[1].trim());
}

export function batches<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
