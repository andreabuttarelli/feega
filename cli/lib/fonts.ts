import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { request } from './api.ts';

export type OrgFont = { assetId: string; family: string; weight: number; italic: boolean; url: string | null };

const PATH = '/api/v1/org/fonts';

const withQuery = (query: Record<string, string | undefined>) => {
  const search = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => Boolean(e[1]))).toString();
  return search ? `${PATH}?${search}` : PATH;
};

async function upload(token: string, file: string, org?: string): Promise<{ font: OrgFont }> {
  const body = JSON.stringify({ name: basename(file), base64: (await readFile(file)).toString('base64') });
  return request<{ font: OrgFont }>(withQuery({ org }), token, { method: 'POST', body });
}

export const fontsApi = {
  list: (token: string, org?: string) => request<{ fonts: OrgFont[] }>(withQuery({ org }), token),
  upload,
  remove: (token: string, family: string, org?: string) => request<{ deleted: string }>(withQuery({ family, org }), token, { method: 'DELETE' })
};
