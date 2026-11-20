import { VisualKind, table, type Rich } from '../alternative';
import { BUTTON_DIFF, EDITOR_VISUAL, OWN_STEPS } from './shared';

export const LOVABLE: Rich = {
  verdict:
    'Lovable turns a prompt into a hosted full-stack app, which is exactly right when there is no code yet. It is the wrong fit once a repo exists and the commits should be yours. Its GitHub sync always creates a new repository, so to start from your code you upload a ZIP. Feega opens the repo you already have and writes edits as diffs.',
  snapshotHeading: 'Lovable and Feega at a glance',
  snapshot: table(
    ['', 'Lovable', 'Feega'],
    [
      ['Starts from', 'A prompt, or a ZIP upload', 'Your existing repo'],
      ['GitHub', 'Sync creates a new repository', 'Edits your folder in place'],
      ['Commit author', 'lovable-dev[bot]', 'You'],
      ['Hosting', 'Included', 'Wherever you host today'],
      ['Usage', 'Free has 5 build credits a day', 'No limits'],
      ['Price', 'Pro is $25 a month', 'Free, Apache-2.0'],
      ['Uses AI', 'Yes', 'No']
    ]
  ),
  highlights: [
    {
      heading: 'Lovable does not open your repo',
      paragraphs: [
        'Per Lovable’s GitHub integration docs as we read them, sync creates a new repository. To start from code you already have, you upload a ZIP. Its commits are authored by lovable-dev[bot].',
        'That is fine for a project born in Lovable. For an existing product, it means a second copy and a bot in your history.'
      ],
      visual: {
        kind: VisualKind.Flow,
        them: { title: 'Bring your app to the tool', steps: ['Zip your project', 'Upload it', 'Prompt the change', 'Sync a new repository'] },
        us: { title: 'Bring the tool to your app', steps: ['Open your repo', 'Click the element', 'Set the value', 'Commit yourself'] }
      },
      caption: 'Neutral illustration of the two paths.'
    },
    {
      heading: 'Your name on your commits',
      paragraphs: [
        'Feega never commits. It writes edits into your files, and your git client records them under your identity, with the message you choose.',
        'Blame, history and review stay exactly as your team set them up.'
      ],
      visual: BUTTON_DIFF,
      caption: 'The change is a diff in your file until you commit it.'
    },
    {
      heading: 'One codebase, not two',
      paragraphs: [
        'Uploading an app to change a page leaves you with two copies to keep in step: the one your customers use and the one the tool edits.',
        'Feega avoids the split. The app you edit is the app you ship.'
      ],
      visual: EDITOR_VISUAL,
      caption: 'The editor works on the project open in your editor.'
    }
  ],
  cost: {
    heading: 'What each one costs',
    paragraphs: [
      'Free has 5 build credits a day and Pro is $25 a month, per Lovable’s plans page when we checked. Credits run per build, so check how many your edits take.',
      'Feega is free and has no credits. It is open source under Apache-2.0.'
    ]
  },
  stepsHeading: 'Try Feega on your repo in five steps',
  steps: OWN_STEPS,
  closing: 'Keep Lovable for a new app. Keep your repo for the one you have.',
  moreQuestions: [
    { q: 'Can Lovable push to my existing repo?', a: 'Not directly; sync creates a new repository.' },
    { q: 'When is Lovable the better choice?', a: 'When you have no code yet and want a hosted full-stack app from a prompt.' },
    { q: 'Does Feega host my app?', a: 'No. You keep your own hosting.' },
    { q: 'Does Feega need a database or login?', a: 'No. It edits front-end files; there is no account.' }
  ]
};
