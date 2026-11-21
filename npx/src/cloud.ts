import type { AccountStore } from '../../inspect/src/host/account';
import { cloudApi } from '../../inspect/src/host/cloud-api';
import { RELAY_URL } from '../../inspect/src/host/share/share-host';
import { bearerOf } from './mcp/auth';

const WEB_URL_VAR = 'FEEGA_WEB_URL';
const RELAY_URL_VAR = 'FEEGA_RELAY_URL';

export const cloudApiOf = (env: NodeJS.ProcessEnv, store: AccountStore) => cloudApi({ base: env[WEB_URL_VAR], token: () => bearerOf({ env, store }) });

export const relayUrlOf = (env: NodeJS.ProcessEnv) => env[RELAY_URL_VAR] ?? RELAY_URL;
