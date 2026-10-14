# Export nel browser in alta qualità

**Prima.** `encodeMp4` passava a mediabunny `bitrate: QUALITY_HIGH`, che calcola il bitrate dai
soli pixel (3 Mbps di riferimento a 1080p, ignora gli fps): una 1080x1920@30 usciva a ~4,7 Mbps,
morbida e a blocchi su grana e linee sottili. La scelta Quality del dialog arrivava solo alla
farm: il percorso nel browser la ignorava, e così il link di `render_video`.

**Ora.** `export/bitrate.ts` calcola pixel × fps × bit per pixel di H.264 × `QUALITY_SCALE`
(Standard 1, High 2,8, Max 5; tetto 100 Mbps): 1080x1920@30 High chiede ~21 Mbps. Se l'encoder
rifiuta, si scende di gradino fino a Standard. VBR e `latencyMode: 'quality'`, GOP 2 s invariato.
`Quality.Max` è nuovo: dialog, TemplateDialog, link di render (salvato nei params del run, i link
vecchi rendono in High), tool `render_video` dell'agente, MCP e CLI. La farm non conosce `max`:
`PRODUCER_QUALITY` lo manda come `high`. `estimateBytes` scala con la stessa tabella.

**Misura** (stesse 180 frame, Chrome, `~/Documents/feega-videos/export-quality/`): prima 4,3 Mbps
PSNR 50,4; Standard 6,8 / 51,4; High 16,3 / 53,6; Max 30,3 / 55,5.

**Scartato.** Render a scala ridotta: escluso, il profilo video della GPU rende già a 1×.
