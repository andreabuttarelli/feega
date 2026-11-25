import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';
const JSON_PATH = fileURLToPath(new URL('../src/lib/server/email-policy/disposable-domains.json', import.meta.url));
const SEED_PATH = fileURLToPath(new URL('./sql/seed-disposable-email-domains.sql', import.meta.url));
const DOMAIN_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/;

export function parseBlocklist(text) {
  const domains = text
    .split('\n')
    .map((line) => line.trim().toLowerCase())
    .filter((line) => DOMAIN_RE.test(line));

  return [...new Set(domains)].sort();
}

export function seedSql(domains) {
  const rows = domains.map((domain) => `  '${domain}'`).join(',\n');

  return `begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

insert into public.blocked_email_domains (domain, kind)
select domain, 'disposable'
from unnest(array[
${rows}
]) as domain
on conflict (domain) do nothing;

commit;
`;
}

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`download failed: ${response.status}`);
  }

  const domains = parseBlocklist(await response.text());
  writeFileSync(JSON_PATH, `${JSON.stringify(domains, null, 0)}\n`);
  writeFileSync(SEED_PATH, seedSql(domains));
  console.log(`${domains.length} domains`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
