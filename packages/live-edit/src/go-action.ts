import { offsetOf, type LiveAt } from './class-patch';
import { dirOf } from './data-source';
import { eventsOf } from './event-handlers';
import type { FileChange, ReadFile } from './files';
import { isLinkTag } from './link-edit';
import { insertAttribute, tagNameAt } from './open-tag';

export enum Go {
  Page = 'page',
  Url = 'url',
  Section = 'section'
}

export type GoAsk = { go: Go; target: string };

export type GoWritten = { ok: true; changes: FileChange[] } | { ok: false; reason: string; at?: LiveAt };

enum Surface {
  React = 'react',
  Svelte5 = 'svelte5',
  Svelte4 = 'svelte4',
  Vue = 'vue'
}

type Facts = { svelte: number | null; kit: boolean; next: boolean; router: boolean };

const SURFACE_FILES: Record<string, Surface> = { tsx: Surface.React, jsx: Surface.React, vue: Surface.Vue, svelte: Surface.Svelte5 };
const FIRST_SVELTE_WITH_RUNES = 5;
const CLICK = 'click';
const USE_CLIENT = /^\s*(['"])use client\1/;
const METADATA_EXPORT = /export\s+(?:const\s+metadata\b|(?:async\s+)?function\s+generateMetadata\b|const\s+generateMetadata\b)/;
const NAVIGATION_IMPORT = /import\s*\{([^}]*)\}\s*from\s*(['"])\$app\/navigation\2/;
const INSTANCE_SCRIPT = /<script(?![^>]*\b(?:module|context\s*=\s*["']module["'])\b)[^>]*>/;
const GOTO_IMPORT = "import { goto } from '$app/navigation';";

const TARGETS: Record<Go, { pattern: RegExp; clean: (target: string) => string; reason: string }> = {
  [Go.Page]: { pattern: /^\/[^\s'"\\`<>{}]*$/, clean: (t) => t.trim(), reason: 'A page address starts with / and has no spaces or quotes.' },
  [Go.Url]: { pattern: /^https?:\/\/[^\s'"\\`<>{}]+$/, clean: (t) => t.trim(), reason: 'A URL starts with http:// or https:// and has no spaces or quotes.' },
  [Go.Section]: { pattern: /^[A-Za-z][\w:.-]*$/, clean: (t) => t.trim().replace(/^#/, ''), reason: 'A section is an element id: letters, digits, - or _.' }
};

type Script = { page: (target: string, facts: Facts) => string; url: (target: string) => string; section: (target: string) => string };

const SCRIPT: Script = {
  page: (target, facts) => (facts.kit ? `goto('${target}')` : `(window.location.href = '${target}')`),
  url: (target) => `window.open('${target}', '_blank', 'noopener,noreferrer')`,
  section: (target) => `document.getElementById('${target}')?.scrollIntoView({ behavior: 'smooth' })`
};

const VUE: Script = {
  page: (target, facts) => (facts.router ? `$router.push('${target}')` : `$event.view.location.href = '${target}'`),
  url: (target) => `$event.view.open('${target}', '_blank', 'noopener,noreferrer')`,
  section: (target) => `$event.view.document.getElementById('${target}')?.scrollIntoView({ behavior: 'smooth' })`
};

const SCRIPTS: Record<Surface, Script> = { [Surface.React]: SCRIPT, [Surface.Svelte5]: SCRIPT, [Surface.Svelte4]: SCRIPT, [Surface.Vue]: VUE };

const ATTRIBUTES: Record<Surface, (code: string) => string> = {
  [Surface.React]: (code) => `onClick={() => ${code}}`,
  [Surface.Svelte5]: (code) => `onclick={() => ${code}}`,
  [Surface.Svelte4]: (code) => `on:click={() => ${code}}`,
  [Surface.Vue]: (code) => `@click="${code}"`
};

const GO_CODE: Record<Go, (script: Script, target: string, facts: Facts) => string> = {
  [Go.Page]: (script, target, facts) => script.page(target, facts),
  [Go.Url]: (script, target) => script.url(target),
  [Go.Section]: (script, target) => script.section(target)
};

function parsed(text: string): { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function factsOf(read: ReadFile, file: string): Promise<Facts> {
  const facts: Facts = { svelte: null, kit: false, next: false, router: false };
  for (let dir = dirOf(file); ; dir = dirOf(dir.slice(0, -1))) {
    const text = await read(`${dir}package.json`);
    if (text !== null) {
      const json = parsed(text);
      const deps = { ...json.devDependencies, ...json.dependencies };
      const major = deps.svelte?.match(/\d+/)?.[0];
      return { svelte: major ? Number(major) : null, kit: '@sveltejs/kit' in deps, next: 'next' in deps, router: 'vue-router' in deps || 'nuxt' in deps };
    }
    if (!dir) {
      return facts;
    }
  }
}

const extensionOf = (file: string) => file.slice(file.lastIndexOf('.') + 1);

function surfaceOf(file: string, facts: Facts): Surface | null {
  const surface = SURFACE_FILES[extensionOf(file)] ?? null;
  return surface === Surface.Svelte5 && facts.svelte !== null && facts.svelte < FIRST_SVELTE_WITH_RUNES ? Surface.Svelte4 : surface;
}

function withGoto(text: string): string {
  const existing = text.match(NAVIGATION_IMPORT);
  if (existing) {
    const names = existing[1].split(',').map((n) => n.trim()).filter(Boolean);
    return names.includes('goto') ? text : text.replace(existing[0], existing[0].replace(/\{[^}]*\}/, `{ ${[...names, 'goto'].join(', ')} }`));
  }
  const script = text.match(INSTANCE_SCRIPT);
  if (script) {
    const end = script.index! + script[0].length;
    return `${text.slice(0, end)}\n  ${GOTO_IMPORT}${text.slice(end)}`;
  }
  return `<script>\n  ${GOTO_IMPORT}\n</script>\n\n${text}`;
}

const inAppRouter = (file: string, facts: Facts) => facts.next && /(?:^|\/)app\//.test(file);

export async function addGo(read: ReadFile, at: LiveAt, ask: GoAsk): Promise<GoWritten> {
  const text = await read(at.file);
  const start = text === null ? -1 : offsetOf(text, at);
  const tag = text === null || start < 0 || text[start] !== '<' ? null : tagNameAt(text, start);
  if (text === null || !tag) {
    return { ok: false, reason: `${at.file}:${at.line}: the element is not where the page says` };
  }
  if (isLinkTag(tag)) {
    return { ok: false, reason: 'This is a link: set its address in the Link section.' };
  }
  const facts = await factsOf(read, at.file);
  const surface = surfaceOf(at.file, facts);
  if (!surface) {
    return { ok: false, reason: `${at.file}: actions are written for React, Next, Svelte and Vue files.` };
  }
  const existing = (await eventsOf(read, at)).find((e) => e.event === CLICK);
  if (existing) {
    return { ok: false, reason: `This element already has a click handler (${existing.attribute}).`, at: existing.at };
  }
  const rule = TARGETS[ask.go];
  const target = rule.clean(ask.target);
  if (!rule.pattern.test(target)) {
    return { ok: false, reason: rule.reason };
  }
  const clientNeeded = inAppRouter(at.file, facts) && !USE_CLIENT.test(text);
  if (clientNeeded && METADATA_EXPORT.test(text)) {
    return { ok: false, reason: 'This file exports metadata, so it cannot become a client component.' };
  }

  const code = GO_CODE[ask.go](SCRIPTS[surface], target, facts);
  const edited = insertAttribute(text, start, ATTRIBUTES[surface](code));
  const imported = surface !== Surface.Vue && facts.kit && ask.go === Go.Page && extensionOf(at.file) === 'svelte' ? withGoto(edited) : edited;
  const after = clientNeeded ? `'use client';\n\n${imported}` : imported;
  return { ok: true, changes: [{ path: at.file, before: text, after }] };
}
