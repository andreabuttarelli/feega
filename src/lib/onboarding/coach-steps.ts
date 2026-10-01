import { CoachStep, type CoachChain } from './coach';

export const COACH_STEP_COUNT = 3;

type Locate = (root: ParentNode, chain: CoachChain) => Element | null;

const nodeEl = (root: ParentNode, id: string | undefined) => (id ? root.querySelector(`.svelte-flow__node[data-id="${id}"]`) : null);

const pickerItem = (root: ParentNode, label: string) =>
  [...root.querySelectorAll('[role="menu"][aria-label="Connect to new"] [role="menuitem"]')].find((el) => el.textContent?.trim() === label) ?? null;

const connectFrom = (label: string, from: keyof CoachChain): Locate => (root, chain) =>
  pickerItem(root, label) ?? root.querySelector('[aria-label="Connect to new…"]') ?? nodeEl(root, chain[from]);

export type CoachStepSpec = { number: number; title: string; body: string; locate: Locate | null };

export const COACH_STEPS: Record<CoachStep, CoachStepSpec> = {
  [CoachStep.AddText]: {
    number: 1,
    title: 'Add a Text node',
    body: 'Click Text in the bar below. We fill in a prompt for you.',
    locate: (root) => root.querySelector('.add-bar button[aria-label="Text"]')
  },
  [CoachStep.AddImage]: {
    number: 2,
    title: 'Connect an Image node',
    body: 'Select the text node, press Connect to new… and pick Image.',
    locate: connectFrom('Image', 'text')
  },
  [CoachStep.AddVideo]: {
    number: 3,
    title: 'Connect a Video node',
    body: 'Select the image node, press Connect to new… and pick Video.',
    locate: connectFrom('Video', 'image')
  },
  [CoachStep.Run]: {
    number: 3,
    title: 'Run the chain',
    body: 'See what this chain makes. These are example results we prepared: nothing is generated and no credits are spent.',
    locate: null
  },
  [CoachStep.Generate]: {
    number: 3,
    title: 'Now generate your own',
    body: 'The results on the canvas are examples, not yours. Run the same chain for real on the cheapest models, within your free credits.',
    locate: null
  }
};
