"use client";

import Link from "next/link";
import { useState } from "react";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#workflow", label: "How it works" },
  { href: "#roles", label: "Roles" },
  { href: "#faq", label: "FAQ" },
  { href: "#about", label: "About us" },
  { href: "#contact", label: "Contact us" },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-8 lg:gap-11">
          <Link href="#top" className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight no-underline">
            AssetFlow <span className="brand-tag">AF</span>
          </Link>
          <nav className="hidden items-center gap-9 lg:flex" aria-label="Primary">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-text-soft transition-colors hover:text-text"
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/login" className="btn btn-ghost hidden sm:inline-flex">
            Log in
          </Link>
          <Link href="/signup" className="btn btn-solid">
            Sign up
          </Link>
          <button
            className="ml-1 rounded-sm border border-line p-2 lg:hidden"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="my-[3px] block h-[2px] w-[18px] bg-text" />
            <span className="my-[3px] block h-[2px] w-[18px] bg-text" />
            <span className="my-[3px] block h-[2px] w-[18px] bg-text" />
          </button>
        </div>
      </div>

      {open && (
        <nav
          className="flex flex-col gap-0 border-b border-line bg-paper px-5 pb-5 pt-2 lg:hidden"
          aria-label="Mobile"
        >
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="border-b border-line py-3 text-sm font-medium text-text-soft"
            >
              {l.label}
            </a>
          ))}
          <Link href="/login" onClick={() => setOpen(false)} className="py-3 text-sm font-medium text-text-soft">
            Log in
          </Link>
        </nav>
      )}
    </header>
  );
}
