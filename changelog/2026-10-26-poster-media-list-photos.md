# Poster photos from a media list render

Poster templates read their photo prop with `mediaList`, whose array branch took `item.src` only. The `media_list` field stores `[{kind, assetId}]`, so every card was dropped and the poster rendered blank. The array branch now resolves `item.src || assets[item.assetId]`.
