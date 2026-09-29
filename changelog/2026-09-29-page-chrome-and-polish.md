# Project pages get a header; UI polish pass

Before: on desktop, a project page opened by URL (Brands, Assets, Calendar,
Settings, Influencers…) rendered bare — no title, no way back to the canvas,
no menu. `PageHead` wrote its title into `page-meta`, but only the mobile top
bar read it. Now `DesktopPageBar` reads the same store (title, subtitle,
actions) and adds menu, "Canvas" back link and credits; the page scrolls in a
padded `main`.

Settings opened by URL on desktop had no section navigation (the sheet has its
own switcher). The settings layout now draws the same `SETTINGS_GROUPS` as a
left nav, only on the settings route itself (`route.id`), so the sheet does not
show two.

Other fixes found in the screenshot review:
- Calendar was Italian (months, weekdays, Today, popover actions). Month and
  weekday names now come from `Intl` in English; strings are English literals
  (en.json had another agent's uncommitted edits).
- `BrandLogo` falls back to initials when a logo URL fails, instead of a broken
  image icon (brands list, brand page, brands panel; calendar chips use the
  toned initials they already had).
- Brand cards showed raw markdown (`## Voice`); `brandExcerpt` strips it.
- Global legacy classes in `app.css` leaked into scoped components: `.tabs`
  put a 22px margin under the mobile tab bar, `.bar` stacked the new header,
  `.card:hover` lifted brand cards. Renamed on the component side.
- Primary buttons were accent in some pages and ink in others; `--sh-primary`
  is now ink, and the hand-rolled primaries in influencers/create-post follow.
- `--heading-tracking` -0.08em → -0.03em: large headings were cramped.
- Doc and web page nodes still had Italian tabs (Leggi/Scrivi, Indirizzo/Codice).
