export type ReportLinkTarget = { share?: string; canvas?: string; node?: string };

export const REPORT_PATH = '/report';

export function reportHref(target: ReportLinkTarget): string {
  const params = new URLSearchParams(Object.entries(target).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const query = params.toString();
  return query ? `${REPORT_PATH}?${query}` : REPORT_PATH;
}
