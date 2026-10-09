# Showcase import: signs as operator, resumes, imports lead-finder

The first real run died after one cut: `publishMotionEmbed` signed assets through
`signAssetPaths`, which refuses a service-role client as proof of membership. The script has no
user session, so `publishMotionEmbed` now takes an optional `AssetSigner`; the script passes one
backed by its own declared service-role client. App callers pass none and keep the member check.

Rerunning is safe: a cut whose stored doc hashes the same as the source writes no revision, and
the embed publish is retried. Lead finder ships two cuts (16x9, 9x16) with logo and music, like
generative.
