# Promote button hidden, /ads refused

With `social_publishing` off the top-bar Promote button (desktop and mobile)
is hidden via `SOCIAL_PUBLISHING_SURFACE.topBarActions`, and `/p/[projectId]/ads`
joins the refused routes. `/promote` stays reachable: its paid tab is not social
publishing, and its organic tab is already filtered.
