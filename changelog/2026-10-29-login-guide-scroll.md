# The in-app browser guide scrolls on short screens

The "Open in your browser" sheet on the login page was a fixed overlay with no height limit: on a short phone viewport (landscape, small iPhone with the in-app toolbar) its bottom steps and buttons fell off-screen. The card now caps at the overlay height and scrolls inside. The login page itself already scrolls (`min-height: 100dvh`, no body lock).
