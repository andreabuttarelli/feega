import type { Source } from '../alternative';

export const LOVABLE_GITHUB: Source = { label: 'Lovable GitHub integration', href: 'https://docs.lovable.dev/integrations/github' };
export const LOVABLE_PLANS: Source = { label: 'Lovable plans', href: 'https://docs.lovable.dev/introduction/subscription-plans' };
export const FRAMER_PRICING: Source = { label: 'Framer pricing', href: 'https://www.framer.com/pricing' };
export const FRAMER_DEVELOPERS: Source = { label: 'Framer developers', href: 'https://www.framer.com/developers/' };
export const FRAMER_AI: Source = { label: 'Framer help: AI and agents', href: 'https://www.framer.com/help/ai/' };
export const FRAMER_PUBLISHING: Source = { label: 'Framer help: publishing and hosting', href: 'https://www.framer.com/help/publishing/' };
export const CLAUDE_SKILLS: Source = { label: 'Claude Code: skills', href: 'https://code.claude.com/docs/en/skills' };
export const CLAUDE_MEMORY: Source = { label: 'Claude Code: memory and CLAUDE.md', href: 'https://code.claude.com/docs/en/memory' };
export const CODEX_REPO: Source = { label: 'OpenAI Codex on GitHub', href: 'https://github.com/openai/codex' };
export const CODEX_CLI: Source = { label: 'OpenAI: Codex CLI', href: 'https://learn.chatgpt.com/docs/codex/cli' };
export const CURSOR_AGENT: Source = { label: 'Cursor: Agent overview', href: 'https://cursor.com/docs/agent/overview' };
export const CURSOR_DESIGN: Source = { label: 'Cursor: Design Mode', href: 'https://cursor.com/docs/agent/design-mode' };
export const FEEGA_AGENTS: Source = { label: 'Feega docs: use Feega with AI agents', href: 'https://docs.feega.app/more/ai-agents/' };

export const cite = (s: Source): string => `<a href="${s.href}" rel="noopener">${s.label}</a>`;

export const QUICK_START_DOCS = 'https://docs.feega.app/getting-started/quick-start/';
export const CHANGES_DOCS = 'https://docs.feega.app/editing/undo-and-changes/';
export const PROPERTIES_DOCS = 'https://docs.feega.app/editing/properties/';
export const BLOG_POST = 'https://blog.feega.app/posts/design-in-your-codebase/';

export const IMG = '/img/alternatives';
