# UI second pass: primitives and remaining surfaces

Second launch-quality review, scored at 1440 and 390 (light and dark).

## Shared canvas with an empty influencer node
`/s/[token]` answered 500 whenever the shared canvas held an influencer node
with nobody picked yet: `influencerView` queried `influencers.id = ''`, and
Postgres rejects an empty uuid. It now returns the empty view without a query.
