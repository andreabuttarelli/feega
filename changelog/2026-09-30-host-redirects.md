# Redirect old and short domains to feega.app

feega.app is hosted on Framer, so Vercel cannot redirect to it (Vercel only
redirects to domains in the project). The app answers 308 to
`https://feega.app<path>` for hosts in `HOSTS_TO_PUBLIC_SITE`
(`dalnulla.com`, `www.dalnulla.com`, `r.feega.app`), first in the hooks chain.
The domains must be added to the Vercel project with DNS pointing to Vercel.
