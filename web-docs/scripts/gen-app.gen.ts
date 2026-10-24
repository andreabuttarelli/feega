import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';
import { z } from 'zod';
import { describeEdit } from '$lib/server/edit/describe-edit';
import { shortcutHelp } from '$lib/motion/shortcuts';
import { FORMAT } from '$lib/motion/export-formats';
import { BRAND_ENDPOINTS } from '../../packages/api-contracts/src/index';
import { listAllTools } from '../../cli/mcp/server';
import { CORE_TOOLS, TOOL_FAMILY } from '../../cli/mcp/surface';

const OUT = fileURLToPath(new URL('../src/content/docs/reference/generated/', import.meta.url));
const CHANGELOG_DIR = fileURLToPath(new URL('../../src/lib/content/changelog/', import.meta.url));
const DOCS_ROOT = fileURLToPath(new URL('../src/content/docs/', import.meta.url));
const REPO_DOCS = fileURLToPath(new URL('../../docs/', import.meta.url));
const GITHUB_BLOB = 'https://github.com/andreabuttarelli/feega/blob/main';
const SCHEMA_OPTIONS = { io: 'input', unrepresentable: 'any' } as const;

type JsonSchema = { properties?: Record<string, JsonProp>; required?: string[] };
type JsonProp = { type?: string | string[]; enum?: unknown[]; description?: string; anyOf?: JsonProp[]; items?: JsonProp };

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();

function typeOf(prop: JsonProp): string {
  if (prop.enum) {
    return prop.enum.map((v) => `\`${String(v)}\``).join(' / ');
  }
  if (prop.anyOf) {
    return prop.anyOf.map(typeOf).join(' / ');
  }
  const base = Array.isArray(prop.type) ? prop.type.join(' / ') : (prop.type ?? 'any');
  return prop.items ? `${base} of ${typeOf(prop.items)}` : base;
}

function fieldsTable(schema: JsonSchema | null): string {
  const props = Object.entries(schema?.properties ?? {});
  if (!props.length) {
    return '_No input._\n';
  }
  const required = new Set(schema?.required ?? []);
  const rows = props.map(([name, p]) => `| \`${name}\` | ${cell(typeOf(p))} | ${required.has(name) ? 'yes' : ''} | ${cell(p.description ?? '')} |`);
  return ['| Field | Type | Required | Notes |', '|---|---|---|---|', ...rows, ''].join('\n');
}

function page(title: string, description: string, body: string): string {
  return `---\ntitle: ${title}\ndescription: ${description}\n---\n\n:::note\nGenerated from the code by \`npm --prefix web-docs run gen\`. Do not edit by hand.\n:::\n\n${body}`;
}

function write(name: string, content: string) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), content);
}

async function editOps() {
  const listed = (await describeEdit({})) as { ops: { name: string; family: string; access: string; summary: string }[] };
  const detailed = (await describeEdit({ schemas: true })) as { schemas: { op: string; input_schema: JsonSchema | null }[] };
  const schemaOf = new Map(detailed.schemas.map((s) => [s.op, s.input_schema]));

  const families = ['canvas', 'frame', 'editor'];
  const intro = `The \`edit\` MCP tool (and \`POST /api/v1/edit\`) changes a canvas through one catalogue of ops. ${listed.ops.length} ops today. Call op \`describe\` for the live list.\n\n- **canvas**: nodes and free elements on the canvas.\n- **frame**: what is inside a frame (elements, props, keyframes, clips).\n- **editor**: editor actions.\n\nAccess \`spend\` means the op uses credits.\n\n`;
  const body = families
    .map((family) => {
      const ops = listed.ops.filter((o) => o.family === family);
      const sections = ops.map((o) => `### \`${o.name}\`\n\n${o.summary}\n\nAccess: \`${o.access}\`\n\n${fieldsTable(schemaOf.get(o.name) ?? null)}`);
      return `## ${family} ops (${ops.length})\n\n${sections.join('\n')}`;
    })
    .join('\n');
  write('edit-ops.md', page('Edit ops', 'Every op the edit tool accepts, generated from the op catalogue.', intro + body));
}

async function mcpTools() {
  const tools = ((await listAllTools()) as { name: string; title?: string; description: string; inputSchema: JsonSchema }[]).sort((a, b) => a.name.localeCompare(b.name));
  const listed = (name: string) => (name in CORE_TOOLS ? 'listed' : `family \`${TOOL_FAMILY[name] ?? 'alias'}\``);

  const index = tools.map((t) => `- [\`${t.name}\`](#${t.name}): ${cell(t.title ?? '')} (${listed(t.name)})`).join('\n');
  const body = tools.map((t) => `## ${t.name}\n\n${t.description}\n\n${fieldsTable(t.inputSchema)}`).join('\n');
  write('mcp-tools.md', page('MCP tools', 'Every tool the feega MCP server can run, generated from the server.', `${tools.length} tools. A session lists only the ${Object.keys(CORE_TOOLS).length} core ones; the rest load with \`find_tools\` / \`load_tools\`, or run through \`edit\` {op: "<tool>", input}.\n\n${index}\n\n${body}`));
}

function restApi() {
  const body = BRAND_ENDPOINTS.map((e) => {
    const schema = z.toJSONSchema(e.input, SCHEMA_OPTIONS) as JsonSchema;
    const failures = e.failures.map((f) => `\`${f.error}\` (${f.status})`).join(', ') || 'none declared';
    const without = e.pathWithoutBrand ? `\n\nWithout a brand: \`${e.method} /api/v1${e.pathWithoutBrand}\`` : '';
    return `## ${e.title}\n\nTool \`${e.tool}\`. \`${e.method} /api/v1/brands/{slug}${e.pathUnderBrand}\`${without}\n\n${e.description}\n\nDestructive: ${e.destructive ? 'yes' : 'no'}. Failures: ${failures}.\n\n${fieldsTable(schema)}`;
  }).join('\n');
  const intro = `These are the endpoints declared in \`packages/api-contracts\`. The app serves more routes under \`/api/v1\` (for example \`/api/v1/edit\`, \`/api/v1/canvas\`, \`/api/v1/motion\`) that have no contract in this package; they are not listed here.\n\nAuth is a Bearer token: a Supabase JWT or a \`feega_\` API key.\n\n`;
  write('rest-api.md', page('REST API contracts', 'Endpoints declared in packages/api-contracts, generated.', intro + body));
}

function exportFormats() {
  const yesNo = (v: boolean) => (v ? 'yes' : 'no');
  const rows = Object.entries(FORMAT).map(([id, f]) => `| ${f.label} | \`${id}\` | \`.${f.ext}\` | ${yesNo(f.alpha)} | ${yesNo(f.audio)} |`);
  const table = ['| Format | Id | File | Transparency | Audio |', '|---|---|---|---|---|', ...rows].join('\n');
  const intro = 'Video and animation formats the exporter offers, read from `src/lib/motion/export-formats.ts`. Still exports (PNG, JPG, WebP, SVG, PDF) and Lottie are described in [Export](/motion/export/).\n\n';
  write('export-formats.md', page('Export formats', 'Video export formats, generated from the exporter.', intro + table + '\n'));
}

function shortcuts() {
  const body = shortcutHelp()
    .map((s) => `## ${s.group}\n\n| Keys | Does |\n|---|---|\n${s.rows.map((r) => `| ${r.keys.map((k) => `\`${k}\``).join(' or ')} | ${cell(r.does)} |`).join('\n')}\n`)
    .join('\n');
  const intro = 'Read from the shortcut registry of the editor (`src/lib/motion/shortcuts.ts`). `⌘` is Ctrl on Windows and Linux. "(Design)" and "(Motion)" mark keys that depend on the edit mode.\n\n';
  write('shortcuts.md', page('Keyboard shortcuts', 'Editor shortcuts, generated from the shortcut registry.', intro + body));
}

async function changelog() {
  const files = readdirSync(CHANGELOG_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}-.*\.ts$/.test(f));
  const entries = await Promise.all(files.map(async (f) => (await import(/* @vite-ignore */ join(CHANGELOG_DIR, f))).default as { date: string; title: string; items: string[] }));
  entries.sort((a, b) => b.date.localeCompare(a.date));
  const body = entries.map((e) => `## ${e.date}: ${e.title}\n\n${e.items.map((i) => `- ${i}`).join('\n')}\n`).join('\n');
  write('changelog.md', page('Changelog', 'What changed for people who use feega.', body));
}

function splitTitle(markdown: string): { title: string; body: string } {
  const [first, ...rest] = markdown.split('\n');
  return { title: first.replace(/^#\s+/, '').trim(), body: rest.join('\n').trimStart() };
}

function pointToRepo(markdown: string, repoDir: string): string {
  return markdown.replace(/\]\((?!https?:|#|mailto:|\/)([^)]+)\)/g, (_m, target: string) => {
    const resolved = join('/', repoDir, target).slice(1);
    return `](${GITHUB_BLOB}/${resolved})`;
  });
}

function writeDoc(relative: string, title: string, description: string, body: string, banner = '') {
  const file = join(DOCS_ROOT, relative);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\n---\n\n${banner}${body}`);
}

function selfHosting() {
  const { title, body } = splitTitle(readFileSync(join(REPO_DOCS, 'SELF_HOSTING.md'), 'utf8'));
  const banner = ':::note\nCopied from `docs/SELF_HOSTING.md` by `npm --prefix web-docs run gen`. Edit that file, not this page.\n:::\n\n';
  writeDoc('self-hosting/index.md', title, 'Run feega on your own machine or server.', pointToRepo(body, 'docs'), banner);
}

function adrs() {
  const dir = join(REPO_DOCS, 'adr');
  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  const banner = ':::note\nCopied from `docs/adr/` by `npm --prefix web-docs run gen`.\n:::\n\n';
  const siblings = (md: string) => md.replace(/\]\((\d{4}-[^)]+)\.md\)/g, (_m, slug: string) => `](/architecture/adr/${slug}/)`);
  const rows = files.map((file) => {
    const { title, body } = splitTitle(readFileSync(join(dir, file), 'utf8'));
    const slug = file.replace(/\.md$/, '');
    writeDoc(`architecture/adr/${slug}.md`, `${slug.slice(0, 4)}. ${title}`, title, siblings(pointToRepo(body, 'docs/adr')), banner);
    return `- [${slug.slice(0, 4)}. ${title}](/architecture/adr/${slug}/)`;
  });
  const intro = 'Architecture decision records: the context, the decision and what was discarded. Newest numbers are the most recent decisions; two records share the number 0012.\n\n';
  writeDoc('architecture/adr/index.md', 'Decision records', 'Why the system is built the way it is.', intro + rows.join('\n') + '\n', banner);
}

test('generate the reference pages', async () => {
  await editOps();
  await mcpTools();
  restApi();
  shortcuts();
  exportFormats();
  await changelog();
  selfHosting();
  adrs();
});
