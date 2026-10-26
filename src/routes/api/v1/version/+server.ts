import { json } from '@sveltejs/kit';
import { parseRelease } from '$lib/release';
import { releaseTag } from '$lib/server/release-tag';
import { localStore } from '$lib/server/local/local-mode';

export const GET = () => {
  const { version, build } = parseRelease(releaseTag());
  return json({ version, build, release: releaseTag(), localMode: localStore() !== null });
};
