import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Catalogue numbers read as two-digit index marks: 7 → "07", 123 → "123". */
export function formatCatalogueNumber(n: number): string {
  return String(n).padStart(2, "0");
}
