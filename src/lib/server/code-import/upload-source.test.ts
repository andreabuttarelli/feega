import { describe, expect, it } from 'vitest';
import { gzipSync, strToU8 } from 'fflate';
import { tarOf } from '$lib/code-upload/tar';
import { uploadOf, uploadPath, uploadSource } from './upload-source';

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const PROJECT = '33333333-3333-4333-8333-333333333333';

const archive = gzipSync(tarOf([{ path: 'app/src/App.tsx', bytes: strToU8('export const App = () => null;') }]));

describe('an uploaded folder snapshot', () => {
  it('lives under the org and project that asked for it', () => {
    const path = uploadPath(ORG, PROJECT, 'my-app');
    expect(path).toMatch(new RegExp(`^${ORG}/${PROJECT}/code-uploads/[0-9a-f-]{36}/my-app$`));
    expect(uploadOf(ORG, path)).toEqual({ path, name: 'my-app' });
  });

  it('a path of another org, or one that climbs out, is refused', () => {
    expect(uploadOf(OTHER, uploadPath(ORG, PROJECT, 'x'))).toBeNull();
    expect(uploadOf(ORG, `${ORG}/${PROJECT}/code-uploads/../../${OTHER}/x`)).toBeNull();
    expect(uploadOf(ORG, '/Users/me/code/app')).toBeNull();
  });

  it('reads files from the snapshot, never moves, and has nowhere to publish', async () => {
    const source = uploadSource(archive);
    const head = await source.head(null);

    expect(head).toMatch(/^[0-9a-f]{40}$/);
    expect(await source.head('main')).toBe(head);
    expect(await source.read(head!)('src/App.tsx')).toBe('export const App = () => null;');
    expect(await source.read(head!)('missing.ts')).toBeNull();
    expect(await source.publish(head!, [{ path: 'src/App.tsx', before: '', after: 'x' }], { branch: 'b', title: 't', body: '' })).toBeNull();
  });
});
