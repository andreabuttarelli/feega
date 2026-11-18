import { json } from '@sveltejs/kit';
import { isSettingsSection, type SettingsSection } from '$lib/settings/sections';
import { SETTINGS_PAGES, type SettingsPage } from '$lib/server/settings/pages';
import { answerOf, bearerOf, type Bearer } from '$lib/server/api/bearer-page';

const NOT_FOUND = 404;

type Handler = (event: never) => unknown;

export type SectionPick = (page: SettingsPage) => Handler | undefined;

export type SectionChain = { gate: () => Promise<unknown>; page: unknown };

export type SectionRequest = {
  request: Request;
  section: string;
  pick: SectionPick;
  served: (section: SettingsSection) => boolean;
  chain: (bearer: Bearer) => SectionChain;
};

const UNKNOWN = () => json({ error: 'not_found' }, { status: NOT_FOUND });

export const LOAD_PICK: SectionPick = (page) => page.load ?? (async () => null);

export const actionPick =
  (name: string): SectionPick =>
  (page) =>
    page.actions?.[name];

export async function serveSection({ request, section, pick, served, chain }: SectionRequest): Promise<Response> {
  if (!isSettingsSection(section) || !served(section)) {
    return UNKNOWN();
  }

  const handler = pick(await SETTINGS_PAGES[section]());
  if (!handler) {
    return UNKNOWN();
  }

  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }

  const { gate, page } = chain(bearer);
  return answerOf(async () => {
    await gate();
    return handler(page as never);
  });
}
