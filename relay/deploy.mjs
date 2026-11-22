import { spawnSync } from 'node:child_process';

export function deployArgs(env) {
  const domain = env.SESSION_DOMAIN;
  const web = env.WEB_ORIGIN;
  if (!domain || !web) {
    throw new Error('SESSION_DOMAIN and WEB_ORIGIN are required');
  }
  return ['wrangler', 'deploy', '--var', `VISITOR_BASE:${domain}`, '--var', `WEB_ORIGIN:${web}`, '--route', `relay.${domain}/*`, '--route', `*.${domain}/*`];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const run = spawnSync('npx', deployArgs(process.env), { stdio: 'inherit' });
  process.exit(run.status ?? 1);
}
