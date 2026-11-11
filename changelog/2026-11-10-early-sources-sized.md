# Early source asks reach frames sized by their format

`earlySourceUrls` dropped every row whose stored size is null, but the page sizes those from `nodeSize(type, data)`. On the user's canvas the frames store no size, so the page-load kick-off asked nothing and the batches started only when CoreFrames mounted (~4.1 s). The early URLs also lacked `org`, which CoreFrames adds, so the canvas would have asked again under a different URL and the batch missed the read-beside-the-canvas-check path. Both now match: same sizing as the page, `org` from the page data, one `frameSourceUrl` for both.
