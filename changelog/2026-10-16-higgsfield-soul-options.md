# Higgsfield Soul: real schema

Soul advertised `resolution` 2K/4K and 10 aspect ratios, copied from the
supplementary `openapi.json`. The model page (`docs/models/soul-standard/generate.md`),
which Higgsfield's llms.txt names authoritative, accepts 720p/1080p and 7 ratios
(9:16 16:9 4:3 3:4 1:1 2:3 3:2). Requests with 2K/4K or 5:4/4:5/21:9 would be
refused. Prices re-sync per resolution on the next `/api/v1/ai-models/sync`.
