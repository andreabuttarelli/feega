import { env } from '$env/dynamic/private';
import type { Db } from '$lib/server/db/client';
import type { Toolkit } from './account-links';
import { accountAccess, type AccountAccess, type Scope } from './account-access';
import { accountStore } from './account-store';
import { composioLinks } from './composio-links';

export const accountFor = (db: Db, scope: Scope, toolkit: Toolkit): AccountAccess => accountAccess(composioLinks(env), accountStore(db, scope), scope, toolkit);
