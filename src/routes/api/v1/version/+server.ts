import { json } from '@sveltejs/kit';
import { parseRelease } from '$lib/release';
import { releaseTag } from '$lib/server/release-tag';
import { localModeOn } from '$lib/server/local-mode';
import { env } from '$env/dynamic/private';

export const GET = () => {
  const { version, build } = parseRelease(releaseTag());
  return json({ version, build, release: releaseTag(), localMode: localModeOn(env) });
};
