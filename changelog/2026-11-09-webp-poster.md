# Posters accept webp

`savePoster` (canvas action and `/api/v1/motion/[nodeId]/poster`) takes
`image/webp` besides jpeg and png: the canvas grabs frame thumbnails as
webp (#1864), so a thumbnail can be saved as the frame poster on save and
shown on a cold open from `posterAssetId` via `/p/.../assets/<id>`.
