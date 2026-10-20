# Canvas page stops shipping the built-in templates twice

Every canvas page load serialised the whole template library (built-ins + org) into the
HTML: 1.6 MB, on a 5-node canvas too. The built-ins already live in the page bundle
(`$lib/motion/template/builtins`, imported by the inline editor), so the load now returns
`orgTemplates` only and the page joins them with `BUILTIN_TEMPLATES`.

Measured on a production build, WebKit iPad Pro 11 profile, median of 3:

| canvas | HTML | revealed | interactive |
|---|---|---|---|
| heavy (82 nodes) before | 2.95 MB | 4390 ms | 4904 ms |
| heavy after | 1.31 MB | 3951 ms | 4466 ms |
| light (5 nodes) before | 2.01 MB | 1655 ms | 2165 ms |
| light after | 0.36 MB | 1502 ms | 2004 ms |

Loopback network: on a real iPad over Wi-Fi the 1.6 MB less to download and decode
weighs more.
