"use client";

import { TrustedClientsShowcase } from "@/components/ruixen/trusted-clients-showcase";
import type { LogoItem } from "@/components/ruixen/trusted-clients-showcase";

const LOGO_CLS =
  "w-auto opacity-65 [filter:brightness(0)] dark:[filter:brightness(0)_invert(1)] transition-opacity hover:opacity-100";

const clients: LogoItem[] = [
  {
    name: "Pellin",
    logo: (
      <img src="/marks/pellin.svg" alt="Pellin" className={`h-5 ${LOGO_CLS}`} />
    ),
  },
  {
    name: "Pailbrook",
    logo: (
      <img
        src="/marks/pailbrook.svg"
        alt="Pailbrook"
        className={`h-4 ${LOGO_CLS}`}
      />
    ),
  },
  {
    name: "Rovenna",
    logo: (
      <img
        src="/marks/rovenna.svg"
        alt="Rovenna"
        className={`h-4 ${LOGO_CLS}`}
      />
    ),
  },
  {
    name: "Belltide",
    logo: (
      <img src="/marks/belltide.svg" alt="Belltide" className={`h-6 ${LOGO_CLS}`} />
    ),
  },
  {
    name: "Saurio",
    logo: (
      <img
        src="/marks/saurio.svg"
        alt="Saurio"
        className={`h-5 ${LOGO_CLS}`}
      />
    ),
  },
  {
    name: "Pennaro",
    logo: (
      <img
        src="/marks/pennaro.svg"
        alt="Pennaro"
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
        className={`h-5 ${LOGO_CLS}`}
      />
    ),
  },
  {
    name: "Wenlow",
    logo: (
      <img src="/marks/wenlow.svg" alt="Wenlow" className={`h-5 ${LOGO_CLS}`} />
    ),
  },
];

export default function TrustedClientsShowcaseDemo() {
  return (
    <TrustedClientsShowcase
      clients={clients}
      title="Trusted by leading teams"
      className="py-0 md:py-0"
    />
  );
}
