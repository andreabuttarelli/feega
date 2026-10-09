import { env as publicEnv } from '$env/dynamic/public';
import { APP_ORIGIN } from '$lib/motion/libs/catalog';

export const libsOrigin = () => (publicEnv.PUBLIC_APP_URL || APP_ORIGIN).replace(/\/$/, '');
