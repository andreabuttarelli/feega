# Brand wizard accepts bare domains

`type="url"` made the browser reject `feega.app`. The field is now text with
`inputmode="url"`; `analyze` and `create` run `normalizeUrl` (adds https://,
rejects non-http(s) or malformed input with 400).
