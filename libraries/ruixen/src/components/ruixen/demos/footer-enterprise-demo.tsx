"use client";

import { FooterEnterprise } from "@/components/ruixen/footer-enterprise";

/* ── actual brand marks ────────────────────────────────────────── */
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

export default function FooterEnterpriseDemo() {
  return (
    <FooterEnterprise
      brandName="ruixen ui"
      description="Modern, fast, and customizable React components — built with Tailwind CSS, TypeScript, and accessibility in mind."
      columns={[
        {
          title: "Product",
          links: [
            { label: "Components", href: "#" },
            { label: "Templates", href: "#" },
            { label: "Pro", href: "#" },
            { label: "Pricing", href: "#" },
            { label: "Integrations", href: "#" },
          ],
        },
        {
          title: "Solutions",
          links: [
            { label: "Startups", href: "#" },
            { label: "Enterprise", href: "#" },
            { label: "Developers", href: "#" },
            { label: "Designers", href: "#" },
          ],
        },
        {
          title: "Developers",
          links: [
            { label: "Documentation", href: "#" },
            { label: "API Reference", href: "#" },
            { label: "CLI & Tooling", href: "#" },
            { label: "Changelog", href: "#" },
          ],
        },
        {
          title: "Resources",
          links: [
            { label: "Guides", href: "#" },
            { label: "Blog", href: "#" },
            { label: "Community", href: "#" },
            { label: "Templates", href: "#" },
          ],
        },
        {
          title: "Company",
          links: [
            { label: "About", href: "#" },
            { label: "Careers", href: "#" },
            { label: "Press", href: "#" },
            { label: "Contact", href: "#" },
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
      copyright="© 2025 ruixen ui. All rights reserved."
    />
  );
}
