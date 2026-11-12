# Landing hero: prompt composer and new headline

The hero's URL field becomes the same composer as the app's `/new`: textarea, kind chips
(motion video, website design), attach images, sources (GitHub, Local folder, Import from
Figma), send. Send navigates to `${APP_URL}/new?prompt=&kind=&source=&attach=1`
(`landing/src/lib/site/prompt/handoff.ts`), prompt capped at 1500 chars. Images cannot cross
origins: the landing only sets `attach=1` so the app asks for them again.

Headline, home title/meta/og, llms.txt summary and SoftwareApplication JSON-LD move to
"Design inside your code with your agents and team." Comparisons and guides untouched.

`/new` reading the query lands with #1952.
