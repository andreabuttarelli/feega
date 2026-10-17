import { env } from '$env/dynamic/public';

export enum Runtime {
  Hosted = 'hosted',
  Bundle = 'bundle'
}

export const RUNTIME: Runtime = env.PUBLIC_FEEGA_RUNTIME === Runtime.Bundle ? Runtime.Bundle : Runtime.Hosted;

export const HOSTED_ORIGIN = (env.PUBLIC_API_BASE ?? '').replace(/\/$/, '');
