# AI media marked in the file, at storage time

**Why.** EU AI Act art. 50(2), from 2 Aug 2026: AI images, video and audio must be marked in a
machine-readable way. Before: XMP only on PNG/JPEG from the OpenRouter path, an ffmpeg comment on
MP4, nothing on ElevenLabs audio, Wiro outputs, WebP, WebM/MOV or effects exports; junk input made
ffmpeg log "Invalid data found when processing input".

**What.** `content-credentials.ts` has one table, `MARKING_STRATEGY` (mime → marker):

| Media | Strategy |
|---|---|
| PNG / JPEG / WebP | XMP in the container (iTXt / APP1 / RIFF `XMP ` + VP8X flag), no re-encode: IPTC `DigitalSourceType`, `Iptc4xmpExt:AISystemUsed` (provider/model), `photoshop:Credit`, `xmp:CreatorTool=feega`. C2PA signing on top when configured. |
| MP4 / MOV / WebM | ffmpeg stream copy with `DigitalSourceType`, `AISystemUsed`, `comment` tags |
| MP3 / WAV | same; ID3v2.3 TXXX + COMM on MP3, LIST/INFO ICMT on WAV |

`markGenerated(bytes, mime, provenance)` sniffs magic bytes before any ffmpeg call, retries once,
and on failure returns the original bytes with `marked: false`: the asset is always stored.
`assets.ai_marked` (migration `20260930120000`, applied) records it: true / false / null (not AI,
or predates this).

Wired at: `media-generate.ts` storeDrawing (images), `video.ts` persistMp4 (renders, transforms,
upscales), `canvas/audio-run.ts` depositAudio (ElevenLabs), `canvas/wiro-run.ts` deposit (Wiro),
`canvas/apply-effects.ts` (composite, only when the source asset is `generated`).

**Discarded.** C2PA as default: `c2pa-node` ships a 38 MB native binary and pushed the Vercel
function past 250 MB. Signing stays optional (`C2PA_SIGNING=on` test signer, or
`C2PA_CERT`/`C2PA_KEY` PEM). Production needs a certificate from a CA on the C2PA trust list, the
package (now `@contentauth/c2pa-node`) installed, and a bundle diet or larger functions. Unsigned
C2PA is not valid, so it is not written. XMP inside MP4: ffmpeg cannot write the `uuid` box; the
container tags carry the same claim. TCOP (copyright) is not used for the AI claim: it would
assert copyright.
