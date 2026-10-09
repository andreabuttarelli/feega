# Entry probe checks every redirect

`resolveEntryUrl`'s probe (site-analysis) guarded the first URL, then let `fetch` follow
redirects blind: a site could bounce it to `169.254.169.254` or localhost. It now walks redirects
by hand (max 5, one shared timeout), running `isUrlSafeToFetch` (DNS-resolved) on every hop.
Stays inside the package: no `$lib` import. Closes the residual noted in PR #341.
