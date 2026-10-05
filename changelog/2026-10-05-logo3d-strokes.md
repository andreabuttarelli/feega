# Logo3D: gli stroke SVG diventano geometria

**Perché.** `SVGLoader.createShapes` riempie i tracciati e ignora lo stroke: il marchio feega
(`stroke-width 2.25`, `fill="none"`) usciva come una forma chiusa sbagliata, e per lo showcase
si è dovuto produrre a mano un SVG col contorno espanso (shapely).

**Cosa.** In `loadLogo` ogni tracciato contribuisce il riempimento solo se `fill` è dipinto, e lo
stroke se `stroke` è dipinto con spessore > 0. `strokePolygons` (`stroke-outline.ts`, inlineata
nella pagina) espande ogni sottotracciato in una fascia per segmento, larga quanto lo stroke,
con cap `square` esteso di metà spessore e un disco a ogni giunto; le forme si estrudono come
il riempimento. Verificato a schermo col marchio originale (`BrandMark.svelte`).

**Scartato.** `SVGLoader.pointsToStroke`: dà triangoli piatti, non `Shape` estrudibili. Unione
booleana dei poligoni: nessuna libreria nella pagina; le parti sovrapposte coincidono.
