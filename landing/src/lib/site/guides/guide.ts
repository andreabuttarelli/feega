export type GuideStep = { readonly name: string; readonly text: string };

export type GuideFaq = { readonly q: string; readonly a: string };

export type GuideSection = { readonly heading: string; readonly html: string };

export type Guide = {
  readonly title: string;
  readonly description: string;
  readonly heading: string;
  readonly answer: string;
  readonly steps: readonly GuideStep[];
  readonly sections: readonly GuideSection[];
  readonly faq: readonly GuideFaq[];
  readonly links: readonly { readonly href: string; readonly label: string }[];
  readonly sources?: readonly { readonly label: string; readonly href: string }[];
  readonly checked: string;
};
