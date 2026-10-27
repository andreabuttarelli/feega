import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { appUrl } from './config.ts';
import { request } from './api.ts';

export type OrgFont = { assetId: string; family: string; weight: number; italic: boolean; url: string | null };

const PATH = '/api/v1/org/fonts';

const withQuery = (query: Record<string, string | undefined>) => {
  const search = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => Boolean(e[1]))).toString();
  return search ? `${PATH}?${search}` : PATH;
};

async function upload(token: string, file: string, org?: string): Promise<{ font: OrgFont }> {
  const form = new FormData();
  form.append('file', new Blob([await readFile(file)]), basename(file));
  const res = await fetch(`${appUrl()}${withQuery({ org })}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  }
  return res.json() as Promise<{ font: OrgFont }>;
}

export const fontsApi = {
  list: (token: string, org?: string) => request<{ fonts: OrgFont[] }>(withQuery({ org }), token),
  upload,
  remove: (token: string, family: string, org?: string) => request<{ deleted: string }>(withQuery({ family, org }), token, { method: 'DELETE' })
};
