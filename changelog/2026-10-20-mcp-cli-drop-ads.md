# MCP and CLI drop ads, dashboard and status

Ads are hidden behind `social_publishing` and the product is motion. Per "app → CLI → MCP", what
served them leaves with them.

Removed:

- MCP tools `list_ad_campaigns`, `create_ad_campaign`, `approve_ad_campaign`,
  `set_ad_campaign_status` (`cli/mcp/tools/ads.ts`). 53 tools become 49.
- REST `api/v1/org/ads/campaigns` (+ `[id]/approve`, `[id]/status`). Only the CLI and MCP called
  them; the Ads page reads its repos directly.
- CLI `feega ads`, `feega dashboard`, `feega status` (they showed pending posts and campaigns),
  and the "Pending" column of `feega brands`.
- Their lines in the skill (both copies), README, llms.txt, docs, the public docs pages and
  `docs/mcp-tools.md` (regenerated).

Kept on purpose: `api/v1/brands/[slug]` (the CLI `products`/`upgrade` still use the slug routes),
and the `ad_*`, `posts`, `social_accounts` tables in the `query`/`insert_row` allowlist (they
still exist in the database and the hidden pages use them). Removing them from the allowlist is
the next step, with the pages.

`cli/mcp/retired-tools.test.ts` fails if a retired name, or any name matching ads, posts,
schedule, calendar, autopilot or routine, comes back in `tools/list`.
