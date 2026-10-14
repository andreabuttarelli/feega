# Download on an exported image saves the file

The still export's Download link pointed at a Supabase signed URL with `download` and
`target="_blank"`. Browsers ignore `download` on a cross-origin link, so the button opened the
image in a new tab (Playwright saw no download, 2/2). `attachmentUrl` adds the storage
`download=<file name>` query, so storage answers with `Content-Disposition: attachment`; the
link no longer opens a tab.
