import { ArticleKind, type Article } from './alternative';
import { FRAMER_ARTICLE, HUB_CHECKED, LOVABLE_SECTIONS } from './hubs';

const CHECKED = '2026-11-18';

export const SINGLES: Readonly<Record<string, Article>> = {
  'framer': FRAMER_ARTICLE,
  'claude-design': {
    kind: ArticleKind.Single,
    title: 'Claude Design alternatives when the code already exists | Feega',
    description: 'Claude Design makes new designs from a chat. When your app already exists, here is what edits it in place instead.',
    heading: 'Claude Design alternatives when the code already exists',
    hook: 'Keep Claude Design for something new. Edit what exists in place.',
    lead: 'Keep Claude Design if you start something new and already pay for Claude. It makes designs, prototypes and slides from a chat, and hands them to Claude Code. Feega edits the product you have already built, by hand.',
    pickThem: { name: 'Claude Design', points: ['You start from a prompt or a document.', 'You need slides or a PDF too.', 'You want no extra seat beyond Claude.'] },
    pickFeega: ['The app exists and must change in place.', 'You want to edit by hand, with no AI and no tokens.', 'The change should be a diff in your files, not a new build.'],
    sections: [
      {
        heading: 'It reads your repo; it does not write to it',
        html: '<p>Claude Design learns your components through a linked repo or <code>/design-sync</code>, then designs in its own project. Claude Code builds the result. Feega changes the source directly, with no AI in the loop.</p>'
      }
    ],
    mistakes: [
      { q: 'Reading “learns your design system” as “edits your app”.', a: 'They are different jobs.' },
      { q: 'Missing the date.', a: 'The standalone claude.ai/design closes on 14 December 2026 and moves into Claude Code.' }
    ],
    questions: [
      { q: 'Is Claude Design free?', a: 'It is included in every Claude plan and shares that plan’s usage.' },
      { q: 'Can Claude Code use Feega too?', a: 'They edit the same files. Feega has no AI of its own; it writes your hand edits to source.' }
    ],
    sources: [
      { label: 'Introducing Claude Design', href: 'https://www.anthropic.com/news/claude-design-anthropic-labs' },
      { label: 'Get started with Claude Design', href: 'https://support.claude.com/en/articles/14604416-get-started-with-claude-design' }
    ],
    checked: CHECKED
  },
  'figma': {
    kind: ArticleKind.Single,
    title: 'Figma alternatives for teams whose product is already built | Feega',
    description: 'Figma is best for new UI from a blank frame. When design and code have drifted apart, here is what edits the real app instead.',
    heading: 'Figma alternatives for teams whose product is already built',
    hook: 'Keep Figma for new UI. Stop rebuilding what already shipped.',
    lead: 'Keep Figma if you design new product UI with a shared library and handoff. It is still the best at that. This page is for teams whose design and code have drifted apart.',
    pickThem: { name: 'Figma', points: ['You start from a blank frame.', 'A large team shares one design system.', 'Developers are happy to rebuild from specs.'] },
    pickFeega: ['The product exists.', 'You want to edit real pages with your own components.', 'The change should land in your source files.'],
    sections: [
      {
        heading: 'Figma is moving toward code too',
        html: '<p>Make can open a local folder or a GitHub clone, but only in a closed beta on the Mac desktop app. Dev Mode reads code through its MCP server and does not edit your repo.</p>'
      }
    ],
    mistakes: [
      { q: 'Replacing Figma for new UI.', a: 'You do not need to. Keep designing new UI there; use Feega on what shipped.' },
      { q: 'Judging on an empty file.', a: 'Try both on your own repo.' }
    ],
    questions: [
      { q: 'Can Figma edit my codebase?', a: 'In the Make local beta, yes. It is not generally available yet.' },
      { q: 'Can Feega read my Figma file?', a: 'No. It edits the app you are running.' }
    ],
    sources: [
      { label: 'Figma Make in your local codebase', href: 'https://help.figma.com/hc/en-us/articles/40775535020695-Make-in-your-local-codebase' },
      { label: 'Figma Dev Mode', href: 'https://www.figma.com/dev-mode/' }
    ],
    checked: CHECKED
  },
  'onlook': {
    kind: ArticleKind.Single,
    title: 'Onlook alternatives when you want it inside your editor | Feega',
    description: 'Onlook is a free, open-source Mac editor for your code. When you work on another OS or want it inside your editor, here is the difference.',
    heading: 'Onlook alternatives when you want it inside your editor',
    hook: 'The closest tool to Feega, and where they differ.',
    lead: 'Keep Onlook if you work alone on a Mac and want a free local app. It is the closest tool to Feega: open source under Apache-2.0, it opens your repo and ships one-press pull requests. Feega covers a different case, the editor you already use.',
    pickThem: { name: 'Onlook', points: ['You want a desktop app on macOS.', 'You want your own folder on your own machine.', 'You like its Storybook and shadcn/ui support.'] },
    pickFeega: ['You work in VS Code, Cursor, Windsurf or VSCodium, on any OS.', 'You want it inside your editor, not a separate app.', 'You want a free tool with no account that sends nothing.'],
    sections: [
      {
        heading: 'The difference is where it lives',
        html: '<p>Onlook is a Mac app that runs your dev server for you and can open a pull request in one press. Feega is a VS Code extension, also on Cursor, Windsurf and VSCodium, or <code>npx feega</code>, and it runs on any OS. It does not open pull requests. If you need your team to edit together, Onlook is the nearer fit today.</p>'
      }
    ],
    mistakes: [
      { q: 'Choosing on licence.', a: 'Both are Apache-2.0.' },
      { q: 'Forgetting the second person.', a: 'Check how a colleague opens the same work. Feega has no shared editing yet.' }
    ],
    questions: [
      { q: 'Is Onlook free?', a: 'Self-hosted is free on GitHub. The hosted version is sold through a demo.' },
      { q: 'Are both open source?', a: 'Yes, under Apache-2.0.' }
    ],
    sources: [
      { label: 'Onlook', href: 'https://onlook.com' },
      { label: 'Onlook on GitHub', href: 'https://github.com/onlook-dev/onlook' }
    ],
    checked: CHECKED
  },
  'cursor-design-mode': {
    kind: ArticleKind.Single,
    title: 'Cursor Design Mode alternatives without an agent | Feega',
    description: 'Cursor Design Mode lets developers annotate a running app. When you would rather click and set values than describe them, here is the option.',
    heading: 'Cursor Design Mode alternatives without an agent',
    hook: 'Keep Design Mode for agent edits. Click and set values by hand.',
    lead: 'Keep Design Mode if you live in Cursor. You annotate the running app and the agent edits the source with the exact component stack. Inside an IDE, little beats it.',
    pickThem: { name: 'Cursor', points: ['You are a developer.', 'You run the dev server yourself.', 'You commit and review in the same window.'] },
    pickFeega: ['You want a Properties bar, not annotations.', 'You want the edit made by hand, with no tokens.', 'You want the change written the same way every time, with no AI.'],
    sections: [
      {
        heading: 'Design Mode hands the edit to an agent',
        html: '<p>It needs Cursor 3.24.18 or later and a running dev server. Feega starts the dev server for you, and runs inside Cursor too.</p>'
      }
    ],
    mistakes: [
      { q: 'Describing a two-second drag.', a: 'Some changes are faster by hand.' },
      { q: 'Choosing one.', a: 'You can use both. Feega installs in Cursor and edits the same source.' }
    ],
    questions: [
      { q: 'What does Cursor cost?', a: 'Free to start; Plus is $8 a month.' },
      { q: 'Does Design Mode commit for me?', a: 'Its page does not say. Commits happen in Cursor as usual.' }
    ],
    sources: [
      { label: 'Cursor Design Mode docs', href: 'https://cursor.com/docs/agent/design-mode' },
      { label: 'Cursor pricing', href: 'https://cursor.com/pricing' }
    ],
    checked: CHECKED
  },
  'stitch': {
    kind: ArticleKind.Single,
    title: 'Stitch alternatives for a codebase you already ship | Feega',
    description: 'Google Stitch designs new UI by prompt and voice. For editing the pages you already ship, here is how the options differ.',
    heading: 'Stitch alternatives for a codebase you already ship',
    hook: 'Keep Stitch for new screens. Edit shipped pages in place.',
    lead: 'Keep Stitch if you design new UI by prompt and voice, then publish. Google’s canvas streams designs live and exports to Antigravity or Netlify.',
    pickThem: { name: 'Stitch', points: ['You start new screens.', 'You want voice and live generation.', 'You want a DESIGN.md file for your rules.'] },
    pickFeega: ['You change existing pages by hand.', 'You want the edit, not a suggestion.', 'You want open source.'],
    sections: [
      {
        heading: 'Stitch Loop is a waitlist for now',
        html: '<p>Stitch Loop, announced on 18 November 2026, connects to your codebase and opens pull requests from metrics. It is on a waitlist.</p>'
      }
    ],
    mistakes: [
      { q: 'Comparing a waitlist with a release.', a: 'Judge what you can open today.' },
      { q: 'Generating what you could edit.', a: 'A new screen is not the same as the one your users know.' }
    ],
    questions: [
      { q: 'What does Stitch cost?', a: 'Google’s pages do not state a price.' },
      { q: 'Does Stitch edit my repo?', a: 'Stitch Loop opens GitHub pull requests, for waitlist users only.' }
    ],
    sources: [
      { label: 'Stitch updates', href: 'https://blog.google/technology/google-labs/stitch-updates/' },
      { label: 'Stitch Loop', href: 'https://blog.google/technology/google-labs/stitch-loop/' }
    ],
    checked: CHECKED
  },
  'v0': {
    kind: ArticleKind.Single,
    title: 'v0 alternatives for apps that already exist | Feega',
    description: 'v0 builds and edits apps from a chat and deploys to Vercel. When you would rather move the thing than describe it, here is the option.',
    heading: 'v0 alternatives for apps that already exist',
    hook: 'Keep v0 for prompting on Vercel. Click what you can see.',
    lead: 'Keep v0 if you prompt and deploy on Vercel. It imports GitHub repos, works on a branch, and opens and merges a pull request when you publish.',
    pickThem: { name: 'v0', points: ['You are on Vercel.', 'You like working in a chat.', 'You want previews in one click.'] },
    pickFeega: ['You would rather click the thing than describe it.', 'You do not host on Vercel.', 'You want open source and no tokens.'],
    sections: [],
    mistakes: [
      { q: 'Prompting a two-second drag.', a: 'Some changes are faster by hand.' },
      { q: 'Counting messages.', a: 'Free allows 7 a day; Plus is $30 per user a month.' }
    ],
    questions: [
      { q: 'Can v0 open my existing repo?', a: 'Yes, through Import from GitHub.' },
      { q: 'Does v0 open pull requests?', a: 'Yes, on publish, and it merges them subject to your repo’s rules.' }
    ],
    sources: [
      { label: 'v0 GitHub docs', href: 'https://v0.app/docs/github' },
      { label: 'v0 pricing', href: 'https://v0.app/pricing' }
    ],
    checked: CHECKED
  },
  'lovable': {
    kind: ArticleKind.Single,
    title: 'Lovable alternatives that keep your repo yours | Feega',
    description: 'Lovable turns a prompt into a hosted app. When the repo already exists and the commits should be yours, here is the difference.',
    heading: 'Lovable alternatives that keep your repo yours',
    hook: 'Keep Lovable for a new app. Keep your repo for the one you have.',
    lead: 'Keep Lovable if there is no code yet. It turns a prompt into a hosted full-stack app.',
    pickThem: { name: 'Lovable', points: ['You start from nothing.', 'Chat is all you want.', 'You want hosting included.'] },
    pickFeega: ['The repo already exists.', 'You want your own commits, not a bot’s.', 'You want edits in your own files, with no AI.'],
    sections: [
      {
        heading: 'Lovable does not open your repo',
        html: '<p>Its GitHub sync always creates a new repository. To start from yours, you upload a ZIP. Its commits are authored by <code>lovable-dev[bot]</code>.</p>'
      },
      ...LOVABLE_SECTIONS
    ],
    mistakes: [
      { q: 'Uploading your app to edit a page.', a: 'You now have two copies to keep in step.' },
      { q: 'Counting only the monthly price.', a: 'Credits run per build; check how many your edits take.' },
      { q: 'Forgetting the branch.', a: 'Lovable syncs one branch at a time, so push to the branch it watches if you want a change back in Lovable.' }
    ],
    questions: [
      { q: 'What does Lovable cost?', a: 'Free has 5 build credits a day; Pro is $25 a month.' },
      { q: 'Can Lovable push to my existing GitHub repo?', a: 'Not directly; sync creates a new repository.' },
      { q: 'Can I use Claude Code, Codex or Cursor on a Lovable project?', a: 'Lovable says you can clone the synced repository and work in your own IDE. Feega edits the same files by hand, so the agent and Feega share one repo.' },
      { q: 'Does Feega replace Lovable?', a: 'Only for projects that already live in code. It has no prompt-to-app builder and no hosting.' }
    ],
    sources: [
      { label: 'Lovable GitHub integration', href: 'https://docs.lovable.dev/integrations/github' },
      { label: 'Lovable plans', href: 'https://docs.lovable.dev/introduction/subscription-plans' },
      { label: 'Feega docs: use Feega with AI agents', href: 'https://docs.feega.app/more/ai-agents/' }
    ],
    checked: HUB_CHECKED
  }
};
