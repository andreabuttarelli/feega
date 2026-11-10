# Frame sources kept in IndexedDB

Every open downloaded and parsed every frame source again, even when nothing changed. Sources
are now kept in IndexedDB (`feega-frame-sources`) under `<node id>@<revision>`: a frame whose
revision is kept draws from it without waiting for the network, while the same request still
goes out and its answer replaces the kept copy (stale-while-revalidate). Writing a revision drops
the older ones of the same frame; writes wait for an idle moment.

Only the stable asset addresses are kept (`addresses` from the batch), never the signed links, which expire; a kept frame draws through the asset redirect until the fresh answer lands.
What stays stale until the next open: brand tokens and linked mains that changed without a new
frame revision.
