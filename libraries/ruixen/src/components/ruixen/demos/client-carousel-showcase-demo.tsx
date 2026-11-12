"use client";

import { ClientCarouselShowcase } from "@/components/ruixen/client-carousel-showcase";
import type { ClientCarouselItem } from "@/components/ruixen/client-carousel-showcase";

const LOGO_CLS =
  "w-auto opacity-65 [filter:brightness(0)] dark:[filter:brightness(0)_invert(1)] transition-opacity hover:opacity-100";

const clients: ClientCarouselItem[] = [
  {
    name: "Formwick",
    logo: (
      <img
        src="/marks/formwick.svg"
        alt="Formwick"
        className={`h-5 ${LOGO_CLS}`}
      />
    ),
  },
  {
    name: "Pailbrook",
    logo: (
      <img
        src="/marks/pailbrook.svg"
        alt="Pailbrook"
        className={`h-5 ${LOGO_CLS}`}
      />
    ),
  },
  {
    name: "Rovenna",
    logo: (
      <img
        src="/marks/rovenna.svg"
        alt="Rovenna"
        className={`h-5 ${LOGO_CLS}`}
      />
    ),
  },
  {
    name: "Belltide",
    logo: (
      <img src="/marks/belltide.svg" alt="Belltide" className={`h-7 ${LOGO_CLS}`} />
    ),
  },
  {
    name: "Saurio",
    logo: (
      <img
        src="/marks/saurio.svg"
        alt="Saurio"
        className={`h-6 ${LOGO_CLS}`}
      />
    ),
  },
  {
    name: "Mosscourt Collective",
    logo: (
      <img
        src="/marks/mosscourt-collective.svg"
        alt="Mosscourt Collective"
        className={`h-5 ${LOGO_CLS}`}
      />
    ),
  },
  {
    name: "Thrennic",
    logo: (
      <img
        src="/marks/thrennic.svg"
        alt="Thrennic"
        className={`h-6 ${LOGO_CLS}`}
      />
    ),
  },
  {
    name: "Wenlow",
    logo: (
      <img src="/marks/wenlow.svg" alt="Wenlow" className={`h-6 ${LOGO_CLS}`} />
    ),
  },
  {
    name: "Pellin",
    logo: (
      <img src="/marks/pellin.svg" alt="Pellin" className={`h-6 ${LOGO_CLS}`} />
    ),
  },
  {
    name: "Kerbside",
    logo: (
      <img src="/marks/kerbside.svg" alt="Kerbside" className={`h-6 ${LOGO_CLS}`} />
    ),
  },
  {
    name: "Starnook",
    logo: (
      <img src="/marks/starnook.svg" alt="Starnook" className={`h-5 ${LOGO_CLS}`} />
    ),
  },
  {
    name: "Drowsy Fox",
    logo: (
      <img
        src="/marks/drowsy-fox.svg"
        alt="Drowsy Fox"
        className={`h-7 ${LOGO_CLS}`}
      />
    ),
  },
];

export default function ClientCarouselShowcaseDemo() {
  return (
    <ClientCarouselShowcase
      clients={clients}
      title="Trusted by leading teams"
      className="py-0 md:py-0"
    />
  );
}
