# Pinterest references for both chat agents

Both agents (canvas chat and motion chat) gain `pinterest_search`, `pinterest_pin` and
`pinterest_board`, backed by ScrapeCreators (`/v1/pinterest/search`, `/pin`, `/board`; 1 credit
per request = $0.002, live-verified 2026-10-09, recorded fixtures in
`src/lib/server/web/fixtures/pinterest-*.json`).

- Shared code: `web/pinterest.ts` normalises the three shapes (search and board are snake_case
  with an `images` map; pin is camelCase with `images_orig`…) into one `Pin`.
- Dominant colour: board pins carry `dominant_color`; search pins don't, so it is read from the
  board cover entry with the same 236x url; the pin endpoint has none (null).
- Search reads a second page only when the first is short of `limit` (≤ 25).
- Cost: every request, failed ones too, goes into the turn cap via `spend`, and into `ai_calls`
  through `scrapeCreatorsGet`, run under the brand/org billing scope.
- Seeing: the tools return text only; the agent looks with `view_images` (stored, screened, people
  check in uncensored projects) and keeps the chosen ones with `import_image` / `import_asset`,
  then storyboard media. Discarded: thumbnails inside the search result (a second viewing path,
  and vision tokens paid for every pin).
- Prompt: Pinterest is for references; never the brand's own asset in the final video unless asked.
