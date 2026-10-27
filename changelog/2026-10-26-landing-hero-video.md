# Landing hero: new title and overview video

The homepage h1 is now "The smart canvas for smarter ideas", with the canvas
overview video directly under it. The old h1 and `<title>` described the
product as an "infinite canvas"; neither llms.txt nor the JSON-LD quoted the
h1, so they are untouched.

The video ships as one 1080p H.264 (3 MB) and a 720p one for viewports up to
800 px (2.2 MB), both faststart. AV1/WebM came out larger than H.264 at the
same quality (4.4 MB), so it was dropped. The LCP element is the poster, a
1280 px WebP preloaded in the head; the video itself is `preload="metadata"`.
An `aspect-ratio` box keeps CLS at 0.
