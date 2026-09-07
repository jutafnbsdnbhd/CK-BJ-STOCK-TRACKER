"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { KITCHEN_NAME } from "@/lib/constants";

export default function Header({ title, back, right }) {
  return (
    <header className="sticky top-0 z-20 bg-base/95 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
        {back ? (
          <Link
            href={back}
            className="shrink-0 rounded-lg p-1.5 -ml-1.5 hover:bg-white active:scale-95 transition"
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </Link>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold truncate">{title}</h1>
          <p className="text-xs text-muted truncate">A&rsquo;rest {KITCHEN_NAME} Central Kitchen</p>
        </div>
        {right}
      </div>
    </header>
  );
}
