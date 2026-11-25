import { describe, expect, it } from 'vitest';
import { cssModuleRule } from './css-module';
import { Scope } from './scoped-rule';

const files = (all: Record<string, string>) => async (path: string) => all[path] ?? null;
const at = (line: number, col = 5) => ({ file: 'src/Hero.jsx', line, col });

const HERO = `import styles from './Hero.module.css';

export function Hero() {
  return (
    <section className={styles.hero}>
      <h1>Ship faster</h1>
    </section>
  );
}
`;

const CSS = `.hero {
  padding: 8px;
}
`;

describe('cssModuleRule', () => {
  it('edits the rule of the module class the element uses', async () => {
    const out = await cssModuleRule(files({ 'src/Hero.jsx': HERO, 'src/Hero.module.css': CSS }), at(5), { padding: '24px', color: 'red' }, undefined, Scope.Class);

    expect(out.ok && out.changes).toEqual([{ path: 'src/Hero.module.css', before: CSS, after: '.hero {\n  padding: 24px;\n  color: red;\n}\n' }]);
  });

  it('scope element on a shared module class gives the element its own class, siblings untouched', async () => {
    const shared = HERO.replace('    </section>', '      <footer className={styles.hero}>x</footer>\n    </section>');
    const out = await cssModuleRule(files({ 'src/Hero.jsx': shared, 'src/Hero.module.css': CSS }), at(5), { color: 'red' }, undefined, Scope.Element);
    const changed = Object.fromEntries((out.ok ? out.changes : []).map((c) => [c.path, c.after]));

    expect(changed['src/Hero.jsx']).toContain('<section className={`${styles.hero} ${styles.heroSection}`}>');
    expect(changed['src/Hero.module.css']).toBe('.hero {\n  padding: 8px;\n}\n\n.heroSection {\n  color: red;\n}\n');
  });

  it('an element whose own class already has a rule gets that rule edited, no new class', async () => {
    const out = await cssModuleRule(files({ 'src/Hero.jsx': HERO, 'src/Hero.module.css': CSS }), at(5), { padding: '24px' }, undefined, Scope.Element);

    expect(out.ok && out.changes).toEqual([{ path: 'src/Hero.module.css', before: CSS, after: '.hero {\n  padding: 24px;\n}\n' }]);
  });

  it('a plain class with a rule in an imported stylesheet gets that rule edited', async () => {
    const page = `import './Hero.css';\n\nexport const Hero = () => <section className="hero">x</section>;\n`;
    const out = await cssModuleRule(files({ 'src/Hero.jsx': page, 'src/Hero.css': CSS }), { file: 'src/Hero.jsx', line: 3, col: 27 }, { padding: '24px' });

    expect(out.ok && out.changes).toEqual([{ path: 'src/Hero.css', before: CSS, after: '.hero {\n  padding: 24px;\n}\n' }]);
  });

  it('scope element a second time reuses the class it added', async () => {
    const owned = HERO.replace('className={styles.hero}', 'className={`${styles.hero} ${styles.heroSection}`}');
    const css = CSS + '\n.heroSection {\n  color: red;\n}\n';
    const out = await cssModuleRule(files({ 'src/Hero.jsx': owned, 'src/Hero.module.css': css }), at(5), { color: 'blue' }, undefined, Scope.Element);

    expect(out.ok && out.changes).toEqual([{ path: 'src/Hero.module.css', before: css, after: CSS + '\n.heroSection {\n  color: blue;\n}\n' }]);
  });

  it('an element without a class gets one from the module and a new rule', async () => {
    const out = await cssModuleRule(files({ 'src/Hero.jsx': HERO, 'src/Hero.module.css': CSS }), at(6, 7), { 'font-weight': '700' });
    const changed = Object.fromEntries((out.ok ? out.changes : []).map((c) => [c.path, c.after]));

    expect(changed['src/Hero.jsx']).toContain('<h1 className={styles.heroH1}>Ship faster</h1>');
    expect(changed['src/Hero.module.css']).toContain('.heroH1 {\n  font-weight: 700;\n}');
  });

  it('a component without a module gets one, imported at the top', async () => {
    const plain = HERO.replace("import styles from './Hero.module.css';\n\n", '').replace(' className={styles.hero}', '');
    const out = await cssModuleRule(files({ 'src/Hero.jsx': plain }), { file: 'src/Hero.jsx', line: 3, col: 5 }, { color: 'red' });
    const changed = Object.fromEntries((out.ok ? out.changes : []).map((c) => [c.path, c]));

    expect(changed['src/Hero.jsx'].after.startsWith("import styles from './Hero.module.css';\n")).toBe(true);
    expect(changed['src/Hero.jsx'].after).toContain('<section className={styles.heroSection}>');
    expect(changed['src/Hero.module.css']).toEqual({ path: 'src/Hero.module.css', before: '', after: '.heroSection {\n  color: red;\n}\n' });
  });

  it('a plain className with no rule anywhere is refused, never inlined', async () => {
    const text = HERO.replace('className={styles.hero}', 'className="hero"');
    const out = await cssModuleRule(files({ 'src/Hero.jsx': text }), at(5), { color: 'red' });

    expect(out.ok).toBe(false);
  });
  describe('a plain class styled through a descendant selector', () => {
    const PAGE = `import './Hero.css';\n\nexport const Hero = () => (\n  <section className="hero">\n    <p className="lead">x</p>\n  </section>\n);\n`;
    const SHEET = '.hero{padding:8px}\n.hero .lead{color:#333}\n';
    const sheets = { 'src/Hero.jsx': PAGE, 'src/Hero.css': SHEET };
    const lead = { file: 'src/Hero.jsx', line: 5, col: 5 };

    it('edits the descendant rule that styles the class', async () => {
      const out = await cssModuleRule(files(sheets), lead, { color: 'red' }, undefined, Scope.Class);

      expect(out.ok && out.changes[0].after).toContain('.hero .lead{color:red}');
    });

    it('edits it in element scope when the class is used once', async () => {
      const out = await cssModuleRule(files(sheets), lead, { color: 'red' }, undefined, Scope.Element);

      expect(out.ok && out.changes[0].after).toContain('.hero .lead{color:red}');
    });

    it('keeps a minified rule on one line', async () => {
      const out = await cssModuleRule(files(sheets), lead, { color: 'red' }, undefined, Scope.Class);

      expect(out.ok && out.changes[0].after).toBe('.hero{padding:8px}\n.hero .lead{color:red}\n');
    });
  });
});
