import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { asSchema, type Tool } from 'ai';
import { fakeDb } from '$lib/server/db/fake-db';
import { createProjectTools } from '$lib/server/project-agent/project-tools';
import { createMotionDelegation } from '$lib/server/project-agent/motion-delegation';
import { createFrameTools } from '$lib/server/project-agent/frame-tools';
import { describeEdit } from './describe-edit';

const SCOPE = { orgId: 'o', projectId: 'p', userId: 'u' };

const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function definitions(tools: Record<string, Tool>) {
  const names = Object.keys(tools).sort();
  return Promise.all(names.map(async (name) => ({ name, description: tools[name].description ?? '', schema: await asSchema(tools[name].inputSchema).jsonSchema })));
}

describe('the tool surfaces do not move while their code is reorganised (changed a tool on purpose? run npx vitest run -u on this file and commit the snapshot)', () => {
  it('the chat tool definitions are byte-identical', async () => {
    const { db } = fakeDb({});
    const tools = {
      ...createProjectTools({ db, ...SCOPE }),
      ...createMotionDelegation({ db, ...SCOPE, origin: 'https://feega.test' }),
      ...createFrameTools({ db, ...SCOPE, open: null, editor: null })
    };
    const defined = await definitions(tools);

    for (const definition of defined) {
      expect(fingerprint(definition)).toMatchSnapshot(`chat tool ${definition.name}`);
    }
  });

  it('the edit catalogue lists the same ops, summaries and schemas', async () => {
    const listing = (await describeEdit({})) as { ops: { name: string }[] };
    const schemas = (await describeEdit({ schemas: true })) as { schemas: { op: string }[] };

    for (const entry of listing.ops) {
      expect(fingerprint(entry)).toMatchSnapshot(`edit op ${entry.name}`);
    }
    for (const detail of schemas.schemas) {
      expect(fingerprint(detail)).toMatchSnapshot(`edit op schema ${detail.op}`);
    }
  });
});
