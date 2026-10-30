import { json } from '@sveltejs/kit';
import type { GithubStatus } from './github-access';

export enum GithubRefusal {
  NotConfigured = 'not_configured',
  NotConnected = 'not_connected',
  Invalid = 'invalid'
}

const STATUS: Record<GithubRefusal, number> = {
  [GithubRefusal.NotConfigured]: 501,
  [GithubRefusal.NotConnected]: 409,
  [GithubRefusal.Invalid]: 400
};

export const refused = (refusal: GithubRefusal) => json({ error: refusal }, { status: STATUS[refusal] });

export const missingLink = (status: GithubStatus): GithubRefusal | null => (!status.configured ? GithubRefusal.NotConfigured : !status.connected ? GithubRefusal.NotConnected : null);

const LOCAL_PATH = /^\/(?!\/)/;

export const localPath = (asked: string | null | undefined) => (asked && LOCAL_PATH.test(asked) ? asked : '/');
