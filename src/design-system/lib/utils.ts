import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Catalogue numbers read as two-digit index marks: 7 → "07", 123 → "123". */
export function formatCatalogueNumber(n: number): string {
  return String(n).padStart(2, "0");
}

/** Up to two initials for a portrait placeholder: "rosa maria diaz" → "RM"; an empty name → "TWC". */
export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "TWC";
}

/** Only absolute http(s) URLs become links; anything else (e.g. `javascript:`) stays plain text. */
export function safeHref(url: string): string | undefined {
  const trimmed = url.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : undefined;
}
