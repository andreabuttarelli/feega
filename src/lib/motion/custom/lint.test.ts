import { describe, expect, it } from 'vitest';
import { lintSource } from './lint';

const ok = { html: '<div class="node"><span class="port"></span></div>', css: '.node{width:200px;background:#111}', js: 'tl.from(root.querySelector(".node"),{scale:0,duration:0.4,ease:"back.out"});' };

const problemsOf = (patch: Partial<typeof ok>) => lintSource({ ...ok, ...patch }).map((p) => p.message);

describe('the authoring contract', () => {
  it('accepts a component that animates only on the provided timeline', () => {
    expect(lintSource(ok)).toEqual([]);
  });

  it.each([
    ['setTimeout(() => {}, 10);', 'setTimeout'],
    ['setInterval(f, 10);', 'setInterval'],
    ['requestAnimationFrame(f);', 'requestAnimationFrame'],
    ['fetch("https://x.y");', 'fetch'],
    ['new XMLHttpRequest();', 'XMLHttpRequest'],
    ['new WebSocket("wss://x");', 'WebSocket'],
    ['import("https://x.y/m.js");', 'import()'],
    ['eval("1");', 'eval'],
    ['new Function("return 1");', 'Function'],
    ['parent.postMessage(1, "*");', 'parent'],
    ['top.location = "x";', 'top'],
    ['window.foo = 1;', 'window'],
    ['document.cookie;', 'document.cookie'],
    ['localStorage.getItem("a");', 'localStorage'],
    ['const t = Date.now();', 'Date.now'],
    ['const d = new Date();', 'new Date()'],
    ['const r = Math.random();', 'Math.random'],
    ['const F = (() => {}).constructor;', 'constructor'],
    ['performance.now();', 'performance']
  ])('refuses %s', (js, name) => {
    expect(problemsOf({ js }).join(' ')).toContain(name);
  });

  it.each(['n.toLocaleString();', 'd.toLocaleDateString("it");', 'new Intl.NumberFormat("en").format(1);'])('refuses %s and points at format', (js) => {
    expect(problemsOf({ js }).join(' ')).toContain('format.');
  });

  it('allows a fixed date and the seeded rand', () => {
    expect(problemsOf({ js: 'const d = new Date(2026, 9, 3); const r = rand();' })).toEqual([]);
  });

  it('allows a local variable that shares a name with a browser global', () => {
    expect(problemsOf({ js: 'const top = 10; const { self } = props; function f(location) { return location + top; }' })).toEqual([]);
  });

  it('reports a syntax error with its line', () => {
    expect(problemsOf({ js: 'tl.to(\n  root,{x:1}' })[0]).toMatch(/line 2|line 3/);
  });

  it.each([
    ['.a{animation:spin 1s}', 'animation'],
    ['@keyframes spin{to{transform:rotate(1turn)}}', '@keyframes'],
    ['.a{transition:opacity .2s}', 'transition'],
    ['@import url(x.css);', '@import'],
    ['.a{background:url(https://evil.example/x.png)}', 'url('],
    ['@font-face{font-family:x;src:url(data:font/woff2;base64,AA)}', '@font-face']
  ])('refuses the css %s', (css, name) => {
    expect(problemsOf({ css }).join(' ')).toContain(name);
  });

  it('allows a data url picture in css', () => {
    expect(problemsOf({ css: '.a{background:url(data:image/png;base64,AAAA)}' })).toEqual([]);
  });

  it.each([
    ['<script>alert(1)</script>', '<script'],
    ['<img src="https://evil.example/p.png">', 'src'],
    ['<div onclick="x()"></div>', 'onclick'],
    ['<iframe src="x"></iframe>', '<iframe'],
    ['<a href="javascript:x()">x</a>', 'javascript:'],
    ['<video autoplay></video>', '<video'],
    ['<style>.a{}</style>', '<style']
  ])('refuses the html %s', (html, name) => {
    expect(problemsOf({ html }).join(' ')).toContain(name);
  });
});
