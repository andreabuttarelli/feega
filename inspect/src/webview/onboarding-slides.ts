export type Slide = { title: string; body: string; more?: string };

export const SLIDES: Slide[] = [
  {
    title: 'design in your codebase',
    body: 'Click any element of your running app and edit it like in Figma. Every change is written to your code as a diff.'
  },
  {
    title: 'you design, your agent codes',
    body: 'Same files, your styling: CSS or Tailwind. Undo anything. No AI, no tokens.',
    more: 'Design mode picks and edits. Navigate mode lets you use your app.'
  },
  {
    title: 'sign in (optional)',
    body: 'Everything works without an account. Signing in connects Feega to your account.'
  }
];
