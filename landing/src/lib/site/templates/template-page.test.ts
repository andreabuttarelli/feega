import { render } from 'svelte/server';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Page from '../../../routes/templates/[id=template]/+page.svelte';
import { load } from '../../../routes/templates/[id=template]/+page.server';

const PRO_IDS = readdirSync(resolve(import.meta.dirname, '../../../../../packages/library/pro'));
const CLOUD = 'Included in Feega Cloud';

async function pageOf(id: string) {
  const data = await (load as unknown as (event: { params: { id: string } }) => Promise<Record<string, unknown>>)({ params: { id } });
  return { data, body: render(Page, { props: { data } as never }).body };
}

describe('the template page', () => {
  it('shows a free item live, with its code', async () => {
    const { body } = await pageOf('hero-centered');
    expect(body).toContain('<iframe');
    expect(body).toContain('tpl-code');
  });

  it.each(PRO_IDS)('shows the pro item %s as a looping video, with no code and no live frame', async (PRO_ID) => {
    const PRO_SOURCE_MARK = `fl-${PRO_ID}`;
    const { data, body } = await pageOf(PRO_ID);
    expect(body).not.toContain('<iframe');
    expect(body).not.toContain('tpl-code');
    expect(body).toContain('<video');
    expect(body).toContain('loop');
    expect(body).toContain(CLOUD);
    expect(body).not.toContain(PRO_SOURCE_MARK);
    expect(JSON.stringify(data)).not.toContain(PRO_SOURCE_MARK);
  });
});
