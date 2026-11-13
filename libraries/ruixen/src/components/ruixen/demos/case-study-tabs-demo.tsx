import {
  CaseStudyTabs,
  type CaseStudy,
} from "@/components/ruixen/case-study-tabs";

const LOGO_CLS =
  "h-5 w-auto [filter:brightness(0)] dark:[filter:brightness(0)_invert(1)] opacity-70 transition-opacity hover:opacity-100";

const cases: CaseStudy[] = [
  {
    brand: {
      id: "coinflect",
      name: "Pennaro",
      logo: (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/marks/pennaro.svg" alt="Pennaro" className={LOGO_CLS} />
      ),
    },
    quote:
      "Our customer-facing dashboards needed to ship in two weeks for a launch. The components dropped in without a single override and the audit team had nothing to flag.",
    author: {
      name: "Priya Raman",
      role: "Engineering Lead, Coinflect",
      avatarUrl: "/avatar-images/avatar-01.jpg",
    },
  },
  {
    brand: {
      id: "ternary",
      name: "Thrennic",
      logo: (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/marks/thrennic.svg" alt="Thrennic" className={LOGO_CLS} />
      ),
    },
    quote:
      "We had a half-dozen tables and forms held together with one-off styling. Replacing them with a consistent system cut our design QA queue by a third.",
    author: {
      name: "Daniel Park",
      role: "Product Manager, Ternary",
      avatarUrl: "/avatar-images/avatar-02.jpg",
    },
  },
  {
    brand: {
      id: "percy",
      name: "Pellin",
      logo: (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/marks/pellin.svg" alt="Pellin" className={LOGO_CLS} />
      ),
    },
    quote:
      "Visual regressions used to surface every release. Switching to tokenized components meant our diffs only flag actual change — not theme drift.",
    author: {
      name: "Elena Voss",
      role: "Head of Design Engineering, Percy",
      avatarUrl: "/avatar-images/avatar-03.jpg",
    },
  },
];

export default function CaseStudyTabsDemo() {
  return <CaseStudyTabs cases={cases} />;
}
