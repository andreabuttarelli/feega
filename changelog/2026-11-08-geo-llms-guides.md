# GEO: llms.txt, guides, crawler rules, comparison FAQs

AI answer engines cited none of our pages for "motion design with Claude Code". The
marketing site had llms.txt and eight comparison pages, but no answer-first pages for the
questions people ask, no FAQ markup on comparisons, and robots.txt named no AI crawler.

- `/guides` with four pages (can Claude Code make videos, launch video, animate a UI,
  best tools), each a 40-60 word answer, FAQ and FAQPage markup, HowTo markup where there
  are steps. Data in `landing/src/lib/site/guides/`; a test pins the word count.
- Comparison pages: titles and intros take the "for AI agents / Claude Code" angle; each
  page gets a FAQ derived from its own data (`compare/faq.ts`) plus FAQPage markup. No new
  competitor claims: everything still comes from the cited sources.
- llms.txt and llms-full.txt carry the new positioning, the connect command and the core MCP
  tools (taken from `cli/mcp/surface.ts`). docs.feega.app gets its own llms.txt and
  llms-full.txt.
- robots.txt (landing, docs, blog) names GPTBot, ClaudeBot, PerplexityBot, Google-Extended.
- Organization and SoftwareApplication JSON-LD gain `sameAs`.
- `docs/marketing/geo-tracking.md`: 20 fixed prompts, a results template, listing copy.

Discarded: a separate set of "alternatives" pages (duplicates the comparison registry) and
a Lottie entry (no cited source for a competitor yet).
