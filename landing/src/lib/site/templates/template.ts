export enum Category {
  Section = 'section',
  Component = 'component',
  App = 'app'
}

export enum Framework {
  Svelte = 'svelte',
  React = 'react',
  Vue = 'vue',
  Astro = 'astro',
  Html = 'html'
}

export enum Tier {
  Free = 'free',
  Pro = 'pro'
}

export type FontNeed = { readonly family: string; readonly weights: readonly number[] };

export type Template = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: Category;
  readonly tags: readonly string[];
  readonly fonts: readonly FontNeed[];
  readonly tier: Tier;
};

export type CodeFile = { readonly name: string; readonly code: string };

export type FrameworkCode = Readonly<Record<Framework, readonly CodeFile[]>>;

export type Faq = { readonly q: string; readonly a: string };

export enum Theme {
  Light = 'light',
  Dark = 'dark'
}

export type HubFramework = Exclude<Framework, Framework.Html>;

export enum Filters {
  Full = 'full',
  Tags = 'tags'
}
