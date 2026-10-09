# Showcase import: asset remap spares names, one cut failing no longer stops the run

`remapAssets` swapped every string equal to an asset id. A template field keyed `logo` next to an
asset with id `logo` got the new asset uuid as its key, and `saveMotionDoc` refused the doc
("field keys are snake_case"). Clip ids, field labels, `clipId` and `prop` were exposed the same way.

Now identifiers (`id`, `name`, `key`, `label`, `clipId`, `prop`, `component`) are never rewritten;
`doc.assets[].id` is remapped explicitly. Values (`assetId`, field defaults, media lists) still are.
Discarded: a schema-driven walk of each asset-bearing prop — more parts for the same result.

`main` now catches per cut, prints `FAILED <key>: <reason>` (including the revision's validation
error), continues, and exits 1 at the end if any cut failed.
