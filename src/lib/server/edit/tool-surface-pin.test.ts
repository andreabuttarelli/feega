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

    expect({ names: defined.map((d) => d.name), fingerprint: fingerprint(defined) }).toMatchSnapshot();
  });

  it('the edit catalogue lists the same ops, summaries and schemas', async () => {
    const listing = await describeEdit({});
    const schemas = await describeEdit({ schemas: true });

    expect(fingerprint(listing)).toMatchSnapshot();
    expect(fingerprint(schemas)).toMatchSnapshot();
  });
});
