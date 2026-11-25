import { OnboardingStep } from '../messages';
import { PixelIcon } from '@feega/pixel-icons/pixel';

export type Slide = { step: OnboardingStep; icon: PixelIcon; title: string; body: string; more?: string };

export const MCP_COMMAND = 'claude mcp add feega -- npx -y feega mcp';
export const SKILL_COMMAND = 'npx skills add andreabuttarelli/feega';
export const SKILL_TITLE = 'Install the Feega skill';
export const SKILL_DETAIL = 'Lets your agent drive Feega';
export const FAQ_QUESTION = "How do I pass a UI element's references to my agent?";
export const FAQ_ANSWER = 'Right-click any element in the preview and choose Copy for agent. Paste it into your agent: it gets the file, the selector and the view.';
export const MCP_DOCS_URL = 'https://docs.feega.app/more/connect-your-agent-via-mcp/';

export const SLIDES: Slide[] = [
  {
    step: OnboardingStep.Welcome,
    icon: PixelIcon.Start,
    title: 'design in your codebase',
    body: 'Click any element of your running app and edit it visually. Every change is written to your code as a diff.'
  },
  {
    step: OnboardingStep.Agent,
    icon: PixelIcon.Editing,
    title: 'you design, your agent codes',
    body: 'Same files, your styling: CSS or Tailwind. Undo anything. No AI, no tokens.',
    more: 'Design mode picks and edits. Navigate mode lets you use your app.'
  },
  {
    step: OnboardingStep.Agents,
    icon: PixelIcon.Stack,
    title: 'Connect Feega to your agents',
    body: 'Feega works with the coding agent you already use.'
  },
  {
    step: OnboardingStep.SignIn,
    icon: PixelIcon.SignIn,
    title: 'sign in (optional)',
    body: 'Everything works without an account. Signing in connects Feega to your account.'
  },
  {
    step: OnboardingStep.Support,
    icon: PixelIcon.Support,
    title: 'help a free, open-source project',
    body: 'Optional. Each one is a small way to keep Feega going.'
  }
];
