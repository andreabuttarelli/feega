# Sidebar: social entries hidden

Rail and burger hid only Calendar when `social_publishing` is off; Ads stayed.
`SOCIAL_PUBLISHING_SURFACE.navEntries` now lists `calendar` and `ads`, read by
one `visibleNav` in `shell-nav.ts` for both rail groups and the burger.
Routes and data untouched; `/ads` stays reachable by URL (not in the refused
routes). Kept: Assets, Brands, Influencers (generation references), Studio,
Settings (its social sections are already filtered). The add bar already hid
the calendar node.
