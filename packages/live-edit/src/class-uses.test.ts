import { describe, expect, it } from 'vitest';
import { classUsesOf } from './class-uses';

const names = (file: string, text: string) => classUsesOf(file, text).map((u) => [u.name, u.line, u.dynamic, u.module]);

describe('classUsesOf', () => {
  it('reads static classes of an html class attribute with the line', () => {
    expect(names('index.html', '<div>\n  <p class="card big"></p>\n</div>')).toEqual([
      ['card', 2, false, null],
      ['big', 2, false, null]
    ]);
  });

  it('reads className of jsx, string and braced string', () => {
    expect(names('A.tsx', 'const a = <p className="a b" />;\nconst b = <p className={"c"} />;')).toEqual([
      ['a', 1, false, null],
      ['b', 1, false, null],
      ['c', 2, false, null]
    ]);
  });

  it('marks a template literal with a variable as dynamic and keeps its static words', () => {
    expect(names('A.tsx', 'const a = <p className={`card ${tone}`} />;')).toEqual([['card', 1, true, null]]);
  });

  it('marks clsx with a variable as dynamic and clsx of literals as static', () => {
    expect(names('A.tsx', "<p className={clsx('a', active && 'b')} />")).toEqual([
      ['a', 1, true, null],
      ['b', 1, true, null]
    ]);
    expect(names('A.tsx', "<p className={clsx('a', 'b')} />")).toEqual([
      ['a', 1, false, null],
      ['b', 1, false, null]
    ]);
  });

  it('resolves css module references to the module file', () => {
    const text = "import styles from './Hero.module.css';\n<p className={styles.hero} />\n<i className={`${styles.a} ${styles['b-c']}`} />";

    expect(names('src/Hero.tsx', text)).toEqual([
      ['hero', 2, false, 'src/Hero.module.css'],
      ['a', 3, false, 'src/Hero.module.css'],
      ['b-c', 3, false, 'src/Hero.module.css']
    ]);
  });

  it('reads svelte class attribute with braces and class directives', () => {
    expect(names('A.svelte', '<p class="a {tone}" class:on={open}></p>')).toEqual([
      ['a', 1, true, null],
      ['on', 1, true, null]
    ]);
  });

  it('reads the vue :class object keys', () => {
    expect(names('A.vue', `<template>\n<p class="a" :class="{ 'is-on': on, big: size }"></p>\n</template>`)).toEqual([
      ['a', 2, false, null],
      ['is-on', 2, true, null],
      ['big', 2, true, null]
    ]);
  });

  it('reads astro class:list', () => {
    expect(names('A.astro', `<p class:list={['a', { b: ok }]} />`)).toEqual([
      ['a', 1, true, null],
      ['b', 1, true, null]
    ]);
  });

  it('ignores files with no markup table', () => {
    expect(names('a.css', '.a { color: red }')).toEqual([]);
  });
});
