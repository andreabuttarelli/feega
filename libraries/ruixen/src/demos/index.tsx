import type { ComponentType } from 'react';

type DemoModule = Record<string, unknown> & { default?: ComponentType };

export type Page = { slug: string; title: string; Demo: ComponentType };

const PAGE_SIZE = 6;
const DEMO_SUFFIX = /\/([a-z0-9-]+)-demo\.tsx$/;

const FAMILIES: [string, RegExp][] = [
  ['heroes', /hero/],
  ['pricing', /pricing|plans|tiers|subscription/],
  ['footers-banners', /footer|banner|header/],
  ['navigation', /navbar|breadcrumb|pagination|menu|tabs|dock|toolbar|scrubber|dots/],
  ['faq', /faq|accordion/],
  ['calendars', /calendar|scheduler|time|date|picker/],
  ['tables', /table|ledger/],
  ['inputs', /input|field|otp|password|tag|select|slider|checkbox|switch|form|filter|search/],
  ['buttons', /button|toggler|link|badge/],
  ['cards', /card|profile|testimonial|story|clients|showcase|carousel|reel|wall|stack|grid/],
  ['text', /text|title|scramble|wordmark|number/]
];

const modules = import.meta.glob<DemoModule>('../components/ruixen/demos/*-demo.tsx', { eager: true });

const demoOf = (module: DemoModule): ComponentType | null => (module.default ?? (Object.values(module).find((v) => typeof v === 'function') as ComponentType | undefined)) ?? null;

const demos = Object.entries(modules)
  .flatMap(([path, module]) => {
    const name = DEMO_SUFFIX.exec(path)?.[1];
    const Demo = demoOf(module);
    return name && Demo ? [{ name, Demo }] : [];
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const familyOf = (name: string) => FAMILIES.find(([, test]) => test.test(name))?.[0] ?? 'more';

function pageOf(slug: string, rows: { name: string; Demo: ComponentType }[]): Page {
  const Demo = () => (
    <main className="bg-background text-foreground">
      {rows.map(({ name, Demo: Item }) => (
        <section key={name} data-ruixen={name} className="flex min-h-[420px] items-center justify-center border-b p-10">
          <Item />
        </section>
      ))}
    </main>
  );
  return { slug, title: slug, Demo };
}

const families = [...FAMILIES.map(([family]) => family), 'more'].map((family) => [family, demos.filter((d) => familyOf(d.name) === family)] as const);

export const PAGES: Page[] = families.flatMap(([family, rows]) =>
  Array.from({ length: Math.ceil(rows.length / PAGE_SIZE) }, (_, i) => pageOf(`${family}-${i + 1}`, rows.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE)))
);
