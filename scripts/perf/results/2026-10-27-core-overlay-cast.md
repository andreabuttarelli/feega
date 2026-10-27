# Core canvas, overlay and group casts, 2026-10-27

Fixture: heavy canvas copy (63 nodes, test@dazero.co org). Headed Chrome stable, real GPU, 1440x900, median of 3 runs, zoomed state at 74% (`PERF_ZOOM=0.74`), core renderer only (`PERF_ONLY=default`). Before = wasm of #1405, after = this branch. Production = `vite build` + `vite preview`, dev = `vite dev`. Reproduce: `PERF_ONLY=default PERF_ZOOM=0.74 npx vite-node scripts/perf/big-canvas.ts`, then `scripts/perf/report.ts`.

## prod

| metric | before x1 | after x1 | before x4 | after x4 |
| --- | --- | --- | --- | --- |
| no blank nodes (ms) | 3268 | 2071 | 5687 | 3316 |
| long tasks (total ms) | 1225 | 1054 | 12491 | 8181 |
| panFit fps median | 60 | 59 | 44 | 60 |
| panFit fps p5 | 54 | 54 | 20 | 54 |
| panFit frames >33 ms | 1 | 2 | 29 | 0 |
| zoom fps median | 60 | 60 | 41 | 46 |
| zoom fps p5 | 54 | 54 | 15 | 15 |
| zoom frames >33 ms | 0 | 1 | 32 | 24 |
| panZoomed fps median | 53 | 51 | 38 | 51 |
| panZoomed fps p5 | 53 | 53 | 19 | 53 |
| panZoomed frame p95 (ms) | 18.7 | 18.7 | 51.8 | 18.7 |
| panZoomed worst frame (ms) | 300.1 | 350.1 | 167.8 | 283.4 |
| panZoomed frames >33 ms | 7 | 9 | 35 | 11 |

## dev

| metric | before x1 | after x1 | before x4 | after x4 |
| --- | --- | --- | --- | --- |
| no blank nodes (ms) | 2464 | 2459 | 4422 | 4192 |
| long tasks (total ms) | 1274 | 1055 | 12544 | 8363 |
| panFit fps median | 59 | 60 | 43 | 60 |
| panFit fps p5 | 54 | 54 | 20 | 54 |
| panFit frames >33 ms | 0 | 1 | 27 | 1 |
| zoom fps median | 60 | 58 | 39 | 43 |
| zoom fps p5 | 54 | 54 | 12 | 12 |
| zoom frames >33 ms | 1 | 3 | 38 | 23 |
| panZoomed fps median | 53 | 52 | 38 | 51 |
| panZoomed fps p5 | 53 | 53 | 19 | 53 |
| panZoomed frame p95 (ms) | 18.7 | 18.7 | 51.6 | 18.7 |
| panZoomed worst frame (ms) | 316.3 | 332.5 | 167.5 | 232.9 |
| panZoomed frames >33 ms | 7 | 9 | 34 | 13 |

Screenshots before/after (production, same fixture): the zoomed state differs by more than 24/255 only inside the harness fps overlay; the load screenshot differs in 0.56% of pixels by less than 24/255 (antialiasing).
