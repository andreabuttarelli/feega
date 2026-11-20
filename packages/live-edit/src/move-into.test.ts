import { describe, expect, it } from 'vitest';
import { StructureOp, structure } from './structure';

const BOXES = `<main>
  <section class="hero">
    <h1>Title</h1>
    <p class="lead">Lead</p>
  </section>
  <section class="rest">
  </section>
</main>
`;

const BOXES_JSX = `export default function Page() {
  return (
    <main>
      <div className="a">
        <p className="lead">Lead</p>
      </div>
      <div className="b"><span>x</span></div>
    </main>
  );
}
`;

const SCOPED = `<div class="card">
  <p class="lead">Lead</p>
</div>
<div class="other"></div>

<style>
  .card > .lead {
    color: red;
  }
</style>
`;

const at = (file: string, line: number, col: number) => ({ file, line, col });
const into = (text: string, file: string, from: [number, number], to: [number, number]) => structure(async () => text, { op: StructureOp.MoveInto, at: at(file, ...from), to: at(file, ...to) });

describe('moveInto', () => {
  it('moves an element into another container, keeping its classes and indentation', async () => {
    const out = await into(BOXES, 'a.svelte', [4, 5], [6, 3]);

    expect(out.ok && out.changes[0].after).toBe(`<main>
  <section class="hero">
    <h1>Title</h1>
  </section>
  <section class="rest">
    <p class="lead">Lead</p>
  </section>
</main>
`);
  });

  it('moves a JSX element into an inline container', async () => {
    const out = await into(BOXES_JSX, 'page.tsx', [5, 9], [7, 7]);

    expect(out.ok && out.changes[0].after).toContain('<div className="b"><span>x</span>\n        <p className="lead">Lead</p>\n      </div>');
  });

  it('refuses to move an element into itself', async () => {
    const out = await into(BOXES, 'a.svelte', [2, 3], [3, 5]);

    expect(out.ok).toBe(false);
  });

  it('warns when a rule is scoped to the old parent', async () => {
    const out = await into(SCOPED, 'a.svelte', [2, 3], [4, 1]);

    expect(out.ok && out.note).toMatch(/\.card/);
  });

  it('does not warn when no rule names the old parent', async () => {
    const out = await into(BOXES, 'a.svelte', [4, 5], [6, 3]);

    expect(out.ok && out.note).toBeUndefined();
  });
});
