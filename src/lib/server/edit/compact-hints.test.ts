import { describe, it, expect } from 'vitest';
import { asSchema, type Tool } from 'ai';
import { INSERT_ROW, UPDATE_ROW } from '@feega/api-contracts';
import { fakeDb } from '$lib/server/db/fake-db';
import { createProjectTools } from '$lib/server/project-agent/project-tools';
import { createFrameTools } from '$lib/server/project-agent/frame-tools';
import { FULL_PATH, Surface, compactWrite } from './compact-result';

const SCOPE = { orgId: 'o', projectId: 'p', userId: 'u' };
const BIG = { node: { id: 'n', version: 1, type: 'text', data: { text: 'x'.repeat(5000) } } };

const fieldsOf = async (t: Tool) => Object.keys(((await asSchema(t.inputSchema).jsonSchema) as { properties?: object }).properties ?? {});

const inApp = () => {
  const { db } = fakeDb({});
  return { canvas: createProjectTools({ db, ...SCOPE }), frame: createFrameTools({ db, ...SCOPE, open: null, editor: null }) };
};

type Check = () => Promise<string[]>;

const CHECKS: Record<Surface, Check> = {
  [Surface.Edit]: async () => [],
  [Surface.Rows]: async () => ['insert_row', 'update_row'].filter((name) => !('verbose' in (name === 'insert_row' ? INSERT_ROW : UPDATE_ROW).input.shape)),
  [Surface.ChatCanvas]: async () => FULL_PATH[Surface.ChatCanvas].tools.filter((name) => !(name in inApp().canvas)),
  [Surface.ChatFrame]: async () => {
    const { frame } = inApp();
    const [name] = FULL_PATH[Surface.ChatFrame].tools;
    return name in frame && (await fieldsOf(frame[name])).includes('verbose') ? [] : [name];
  }
};

describe('a trimmed answer names a way to the whole data that exists on its own surface', () => {
  for (const surface of Object.values(Surface)) {
    it(`${surface}: the tools and option it names are real`, async () => {
      expect(await CHECKS[surface]()).toEqual([]);
    });

    it(`${surface}: the trimmed answer carries that hint`, () => {
      const out = compactWrite(BIG, { touched: ['data'], surface }) as { whole?: string; node: { data: string } };

      expect(out.whole).toBe(FULL_PATH[surface].hint);
      expect(out.node.data).toContain(FULL_PATH[surface].hint);
    });
  }

  it('no surface tells the model to ask verbose unless the option exists there', () => {
    for (const path of Object.values(FULL_PATH)) {
      expect(path.hint.includes('verbose'), path.hint).toBe(path.option === 'verbose');
    }
  });
});
