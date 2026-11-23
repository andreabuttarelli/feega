import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scalesOf } from './scales';
import { StylingChoice } from '../settings';

function project(manifest: object, css = ''): string {
  const root = mkdtempSync(join(tmpdir(), 'inspect-scales-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), JSON.stringify(manifest));
  writeFileSync(join(root, 'src/app.css'), css);
  return root;
}

const TAILWIND = { devDependencies: { tailwindcss: '^4.0.0' } };

describe('scalesOf', () => {
  it('reads the theme of a Tailwind project', async () => {
    const scales = await scalesOf(project(TAILWIND, '@theme { --radius-card: 14px; }'), StylingChoice.Auto);

    expect(scales?.radius).toContainEqual({ px: 14, name: 'card' });
  });

  it('has no scales for a project that styles with plain CSS', async () => {
    expect(await scalesOf(project({}), StylingChoice.Auto)).toBeNull();
  });

  it('follows the styling setting', async () => {
    expect(await scalesOf(project(TAILWIND), StylingChoice.Css)).toBeNull();
  });
});
