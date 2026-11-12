export type PostSection = { readonly heading: string; readonly html: string };

export type Post = {
  readonly title: string;
  readonly description: string;
  readonly heading: string;
  readonly lede: string;
  readonly published: string;
  readonly sections: readonly PostSection[];
};
