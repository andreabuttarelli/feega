# Tiles: no warm-up while frames are still building

With tiles on, a warm open of the landings canvas kept the loading screen about 1.5 s longer at
CPU 1x: between uploads the idle bake rastered 3×3 tile blocks (tens of ms each on imported pages)
while frame groups were still being built. The warm-up now also waits until the library has no
frame group building (`Warmup::due_when`, `Building`).

Load bench (fixed query parsing, #1940), tiles off vs on, 2 runs: CPU 1x cold first 3.66–3.69 /
3.47–3.48 s, warm 2.14–2.28 / 2.21–2.28 s; CPU 4x cold 7.55–7.65 / 7.98–8.0 s, warm 6.86–7.17 /
7.10–7.23 s; sharp within 0.2 s either way.
