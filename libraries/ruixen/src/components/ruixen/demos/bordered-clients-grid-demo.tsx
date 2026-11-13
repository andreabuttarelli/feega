"use client";

import BorderedClientsGrid from "@/components/ruixen/bordered-clients-grid";

const LOGO_CLS =
  "w-auto opacity-65 [filter:brightness(0)] dark:[filter:brightness(0)_invert(1)] transition-opacity hover:opacity-100";

export default function BorderedClientsGridDemo() {
  return (
    <BorderedClientsGrid
      logos={[
        {
          name: "Starnook",
          node: (
            <img
              src="/marks/starnook.svg"
              alt="Starnook"
              className={`h-4 ${LOGO_CLS}`}
            />
          ),
        },
        {
          name: "Pailbrook",
          node: (
            <img
              src="/marks/pailbrook.svg"
              alt="Pailbrook"
              className={`h-4 ${LOGO_CLS}`}
            />
          ),
        },
        {
          name: "Rovenna",
          node: (
            <img
              src="/marks/rovenna.svg"
              alt="Rovenna"
              className={`h-4 ${LOGO_CLS}`}
            />
          ),
        },
        {
          name: "Belltide",
          node: (
            <img
              src="/marks/belltide.svg"
              alt="Belltide"
              className={`h-6 ${LOGO_CLS}`}
            />
          ),
        },
        {
          name: "Saurio",
          node: (
            <img
              src="/marks/saurio.svg"
              alt="Saurio"
              className={`h-5 ${LOGO_CLS}`}
            />
          ),
        },
        {
          name: "Pennaro",
          node: (
            <img
              src="/marks/pennaro.svg"
              alt="Pennaro"
              className={`h-5 ${LOGO_CLS}`}
            />
          ),
        },
        {
          name: "Thrennic",
          node: (
            <img
              src="/marks/thrennic.svg"
              alt="Thrennic"
              className={`h-5 ${LOGO_CLS}`}
            />
          ),
        },
        {
          name: "Wenlow",
          node: (
            <img
              src="/marks/wenlow.svg"
              alt="Wenlow"
              className={`h-5 ${LOGO_CLS}`}
            />
          ),
        },
        {
          name: "Pellin",
          node: (
            <img
              src="/marks/pellin.svg"
              alt="Pellin"
              className={`h-5 ${LOGO_CLS}`}
            />
          ),
        },
        {
          name: "Kerbside",
          node: (
            <img
              src="/marks/kerbside.svg"
              alt="Kerbside"
              className={`h-5 ${LOGO_CLS}`}
            />
          ),
        },
      ]}
    />
  );
}
