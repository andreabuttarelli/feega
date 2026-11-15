# Lookups by id use a Map or Set

Delete, copy, section drop, layer panel rows, stacking, code export and pending-place landing
searched an array by id once per row. On ~2,000 items that is millions of compares per edit. Each
now builds a Map/Set once. Rejected: timing-based tests (flaky); tests count scans instead.
