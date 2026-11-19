import { describe, expect, it } from 'vitest';
import { cssModuleRule } from './css-module';

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
    const out = await cssModuleRule(files({ 'src/Hero.jsx': HERO, 'src/Hero.module.css': CSS }), at(5), { padding: '24px', color: 'red' });

    expect(out.ok && out.changes).toEqual([{ path: 'src/Hero.module.css', before: CSS, after: '.hero {\n  padding: 24px;\n  color: red;\n}\n' }]);
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

  it('a className that is a plain string is refused, never inlined', async () => {
    const text = HERO.replace('className={styles.hero}', 'className="hero"');
    const out = await cssModuleRule(files({ 'src/Hero.jsx': text }), at(5), { color: 'red' });

    expect(out.ok).toBe(false);
  });
});
