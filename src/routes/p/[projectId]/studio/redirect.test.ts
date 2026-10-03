import { describe, expect, it } from 'vitest';

async function refusal(run: () => unknown): Promise<{ status?: number; location?: string }> {
  try {
    await run();
  } catch (e) {
    return e as { status: number; location: string };
  }
  return {};
}

describe('the old project-scoped studio URLs move to /app/studio for good', () => {
  it('the wizard keeps its project as the source', async () => {
    const { load } = await import('./+page.server');
    expect(await refusal(() => load({ params: { projectId: 'p1' } } as never))).toMatchObject({ status: 308, location: '/app/studio?project=p1' });
  });

  it('a batch keeps its id', async () => {
    const { load } = await import('./[batchId]/+page.server');
    expect(await refusal(() => load({ params: { projectId: 'p1', batchId: 'b1' } } as never))).toMatchObject({ status: 308, location: '/app/studio/b1' });
  });

  it('the zip download keeps working from an old link', async () => {
    const { GET } = await import('./[batchId]/zip/+server');
    expect(await refusal(() => GET({ params: { projectId: 'p1', batchId: 'b1' } } as never))).toMatchObject({ status: 308, location: '/app/studio/b1/zip' });
  });
});
