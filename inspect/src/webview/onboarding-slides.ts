import { OnboardingStep } from '../messages';

export type Slide = { step: OnboardingStep; title: string; body: string; more?: string };

export const SLIDES: Slide[] = [
  {
    step: OnboardingStep.Welcome,
    title: 'design in your codebase',
    body: 'Click any element of your running app and edit it visually. Every change is written to your code as a diff.'
  },
  {
    step: OnboardingStep.Agent,
    title: 'you design, your agent codes',
    body: 'Same files, your styling: CSS or Tailwind. Undo anything. No AI, no tokens.',
    more: 'Design mode picks and edits. Navigate mode lets you use your app.'
  },
  {
    step: OnboardingStep.SignIn,
    title: 'sign in (optional)',
    body: 'Everything works without an account. Signing in connects Feega to your account.'
  }
];
