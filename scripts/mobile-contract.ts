import { writeFileSync } from 'node:fs';
import { contractSchema } from '../src/lib/api/mobile-contract';

const SCHEMA_FILE = 'apps/mobile/contract/api.schema.json';

writeFileSync(SCHEMA_FILE, `${JSON.stringify(contractSchema(), null, 2)}\n`);
console.log(`wrote ${SCHEMA_FILE}`);
