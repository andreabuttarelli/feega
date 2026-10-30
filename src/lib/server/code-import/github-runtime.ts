import { env } from '$env/dynamic/private';
import type { Db } from '$lib/server/db/client';
import { accountStore } from '$lib/server/connections/account-store';
import { composioLinks } from '$lib/server/connections/composio-links';
import { githubAccess, type GithubAccess } from './github-access';

export const githubFor = (db: Db, scope: { orgId: string; userId: string }): GithubAccess => githubAccess(composioLinks(env), accountStore(db, scope), scope);
