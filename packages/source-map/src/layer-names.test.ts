import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { nameOf } from './runtime.js';

const SRC = 'data-feega-src="src/App.svelte:1:1"';

const elementOf = (html: string) => new JSDOM(`<body>${html}</body>`).window.document.body.firstElementChild!;

const FIXTURES: [string, string, string][] = [
  ['heading uses its text', `<h1 ${SRC}>Design in your codebase</h1>`, 'Design in your codebase'],
  ['heading without text', `<h3 ${SRC}></h3>`, 'Heading 3'],
  ['paragraph uses its text', `<p ${SRC} class="text-sm text-gray-500">  Hello   world </p>`, 'Hello world'],
  ['long text is truncated', `<p ${SRC}>${'a'.repeat(40)}</p>`, `${'a'.repeat(32)}…`],
  ['span with text', `<span ${SRC} class="inline-flex">New</span>`, 'New'],
  ['empty span', `<span ${SRC} class="inline-flex"></span>`, 'Text'],
  ['link with text', `<a ${SRC} class="text-sm" href="/">Pricing</a>`, 'Pricing'],
  ['link with aria-label', `<a ${SRC} aria-label="GitHub" href="/"><svg></svg></a>`, 'GitHub'],
  ['bare link', `<a ${SRC} href="/"><svg></svg></a>`, 'Link'],
  ['button with text', `<button ${SRC} class="px-4 py-2">Get started</button>`, 'Get started'],
  ['button with aria-label', `<button ${SRC} aria-label="Close"></button>`, 'Close'],
  ['bare button', `<button ${SRC}></button>`, 'Button'],
  ['label with text', `<label ${SRC}>Email</label>`, 'Email'],
  ['list item with text', `<li ${SRC}>First</li>`, 'First'],
  ['list item with only a child', `<li ${SRC}><a>x</a></li>`, 'List item'],
  ['image with alt', `<img ${SRC} alt="Team photo">`, 'Team photo'],
  ['image without alt', `<img ${SRC}>`, 'Image'],
  ['svg with aria-label', `<svg ${SRC} aria-label="Logo"></svg>`, 'Logo'],
  ['svg', `<svg ${SRC}></svg>`, 'Vector'],
  ['icon attribute wins', `<svg ${SRC} data-feega-icon="arrow-right"></svg>`, 'arrow-right'],
  ['video', `<video ${SRC}></video>`, 'Video'],
  ['input', `<input ${SRC}>`, 'Input'],
  ['input with aria-label', `<input ${SRC} aria-label="Search">`, 'Search'],
  ['textarea', `<textarea ${SRC}></textarea>`, 'Text area'],
  ['select', `<select ${SRC}></select>`, 'Select'],
  ['form', `<form ${SRC}></form>`, 'Form'],
  ['unordered list', `<ul ${SRC}></ul>`, 'List'],
  ['ordered list', `<ol ${SRC}></ol>`, 'List'],
  ['nav', `<nav ${SRC} class="flex gap-4"></nav>`, 'Nav'],
  ['header', `<header ${SRC}></header>`, 'Header'],
  ['footer', `<footer ${SRC}></footer>`, 'Footer'],
  ['section', `<section ${SRC}></section>`, 'Section'],
  ['main', `<main ${SRC}></main>`, 'Main'],
  ['article', `<article ${SRC}></article>`, 'Article'],
  ['aside', `<aside ${SRC}></aside>`, 'Aside'],
  ['plain div', `<div ${SRC}></div>`, 'Frame'],
  ['div with tailwind classes only', `<div ${SRC} class="mt-4 sm:flex md:w-1/2 w-[200px] px-4 bg-white rounded-lg"></div>`, 'Frame'],
  ['flex row div', `<div ${SRC} style="display:flex"></div>`, 'Row'],
  ['flex column div', `<div ${SRC} style="display:flex;flex-direction:column"></div>`, 'Stack'],
  ['grid div', `<div ${SRC} style="display:grid"></div>`, 'Grid'],
  ['id names a container', `<div ${SRC} id="pricing"></div>`, 'Pricing'],
  ['id names a section', `<section ${SRC} id="how-it-works"></section>`, 'How it works'],
  ['semantic class names a container', `<div ${SRC} class="flex hero-card p-4"></div>`, 'Hero card'],
  ['camel case class', `<div ${SRC} class="heroCard"></div>`, 'Hero card'],
  ['generated classes are ignored', `<div ${SRC} class="svelte-1abc2 _title_1qmmg_34 css-xyz"></div>`, 'Frame'],
  ['generated id is ignored', `<div ${SRC} id="radix-:r1:"></div>`, 'Frame'],
  ['text wins over class on a text element', `<h2 ${SRC} class="hero-title">Welcome</h2>`, 'Welcome'],
  ['unknown tag is capitalised', `<figure ${SRC}></figure>`, 'Figure']
];

describe('layer names', () => {
  it.each(FIXTURES)('%s', (_label, html, expected) => {
    expect(nameOf(elementOf(html))).toBe(expected);
  });

  it('keeps the component name for a component root', () => {
    const win = new JSDOM(`<body><main data-feega-src="src/routes/+page.svelte:1:1"><section class="hero" data-feega-src="src/lib/Hero.svelte:1:1"></section></main></body>`).window;

    expect(nameOf(win.document.querySelector('section')!)).toBe('Hero');
  });
});
