# Photo Studio: catalogue influencers selectable

Before: `castingVerdict` refused every catalogue influencer (`orgId === null`) as `RealPerson`, so
the picker always showed them disabled. User decision: allow them.

`RealPerson` is removed from the verdict table; `orgId` left `ModelFacts` since nothing else read
it. Catalogue influencers go through the same age checks (unknown age, under 21) as the rest.
Uploaded-photo influencers stay blocked. The uncensored "no people in references" rule and the
style-reference no-people confirmation are untouched.
