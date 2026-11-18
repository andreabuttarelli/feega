# The public changelog loads as you scroll

`/changelog` prerendered every entry (2,100+) into one page of about 1 MB of HTML. Now
`+page.server.ts` sends only the newest 40 (`CHANGELOG_PAGE_SIZE` in `changelog-pages.ts`), and
the rest are prerendered as `/changelog/page/<n>.json`. An IntersectionObserver on the "Show
more" button fetches the next page 800px before the reader gets there, re-observing after each
page so a fast scroll keeps loading; the button also works by click and says "Try again" when a
fetch fails. Page HTML: about 1 MB → 60 KB. Checked in a built preview at 390px: 40 entries on
open, every page loaded while scrolling, button gone at the end.
