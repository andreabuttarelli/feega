import type { Platform } from './host/platform';

export const CLOUD_SETTING = 'feegaInspect.cloud.enabled';
export const CLOUD_ENV = 'FEEGA_CLOUD';
const ENV_ON = '1';

export type CloudPorts = Pick<Platform, 'share' | 'cloud'>;

export const cloudEnabled = ({ setting, env }: { setting: boolean | undefined; env: NodeJS.ProcessEnv }): boolean => setting === true || env[CLOUD_ENV] === ENV_ON;

export const cloudPorts = (enabled: boolean, build: () => CloudPorts): CloudPorts => (enabled ? build() : {});
