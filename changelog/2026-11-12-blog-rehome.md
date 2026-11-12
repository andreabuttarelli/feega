# Landing `/blog` split: comparisons to `/compare`, posts to blog.feega.app

The landing's `/blog` mixed nine comparison pages with one article. Comparisons now live at `/compare/<tool>` (`/compare/figma`, …), the shape the old `/compare/:tool` URLs already had, so those inbound links resolve again without a redirect. The article `how-the-canvas-got-fast` moved to `web-blog` as MDX with a generated cover; `landing/src/lib/site/posts/` and the `post` matcher are gone.

Redirects (301, one hop) in `landing/vercel.json`: `/blog/feega-vs-:tool` → `/compare/:tool`, `/blog/how-the-canvas-got-fast` → `https://blog.feega.app/posts/how-the-canvas-got-fast/`, `/blog` → `/compare` (the old index was the comparisons index: its title and description), any other `/blog/*` → blog home. The previous `/compare` → `/blog` rules were removed. `redirects.test.ts` replays `vercel.json` and fails if a page links to `/blog`.
