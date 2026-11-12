"use client";

import FooterPro from "@/components/ruixen/footer-pro";

/* ── actual brand marks (filled SVGs, not outline icons) ───────── */
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}><circle cx="50%" cy="50%" r="40%" fill="currentColor" /></svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}><circle cx="50%" cy="50%" r="40%" fill="currentColor" /></svg>
  );
}

export default function FooterProDemo() {
  return (
    <FooterPro
      brandName="ruixen ui"
      description="Modern, fast, and customizable React components — built with Tailwind CSS, TypeScript, and accessibility in mind."
      columns={[
        {
          title: "Product",
          links: [
            { label: "Components", href: "#" },
            { label: "Templates", href: "#" },
            { label: "Pro", href: "#" },
            { label: "Changelog", href: "#" },
          ],
        },
        {
          title: "Resources",
          links: [
            { label: "Documentation", href: "#" },
            { label: "API Reference", href: "#" },
            { label: "Guides", href: "#" },
            { label: "Examples", href: "#" },
          ],
        },
        {
          title: "Community",
          links: [
            { label: "Brambleworks", href: "#" },
            { label: "Discord", href: "#" },
            { label: "Twitter", href: "#" },
            { label: "Blog", href: "#" },
          ],
        },
        {
          title: "Legal",
          links: [
            { label: "Privacy", href: "#" },
            { label: "Terms", href: "#" },
            { label: "License", href: "#" },
          ],
        },
      ]}
      socials={[
        { icon: GithubIcon, href: "#", label: "Brambleworks" },
        { icon: XIcon, href: "#", label: "X" },
        { icon: LinkedinIcon, href: "#", label: "LinkedIn" },
      ]}
      bottomLinks={[
        { label: "Privacy", href: "#" },
        { label: "Terms", href: "#" },
        { label: "Sitemap", href: "#" },
      ]}
      statusText="All systems operational"
      copyright="© 2025 ruixen ui. All rights reserved."
    />
  );
}
