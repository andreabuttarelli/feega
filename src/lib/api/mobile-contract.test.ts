import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contractSchema } from './mobile-contract';

const SCHEMA_FILE = 'apps/mobile/contract/api.schema.json';

describe('mobile contract', () => {
  it('the committed JSON schema is the one generated from the TypeScript (npm run mobile:contract)', () => {
    expect(JSON.parse(readFileSync(SCHEMA_FILE, 'utf8'))).toEqual(contractSchema());
  });
});
