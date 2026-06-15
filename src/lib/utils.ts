import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function unmaskDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function maskCPF(value: string): string {
  const d = unmaskDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function maskPhone(value: string): string {
  const d = unmaskDigits(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function displayCPF(value: string | null | undefined): string {
  if (!value) return "—";
  const d = unmaskDigits(value);
  if (d.length === 11) return maskCPF(d);
  return value;
}

export function displayPhone(value: string | null | undefined): string {
  if (!value) return "—";
  const d = unmaskDigits(value);
  if (d.length === 10 || d.length === 11) return maskPhone(d);
  return value;
}

/**
 * Remove acentos diacríticos (NFD + faixa combining marks).
 * Use para normalização de busca (case-insensitive + accent-insensitive).
 */
export function stripAccents(value: string | null | undefined): string {
  if (!value) return "";
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Title Case ciente de partículas em português ("João dos Santos", não
 * "João Dos Santos"). Primeira palavra é sempre capitalizada.
 * NÃO altera acentos — apenas caixa.
 */
const PT_PARTICULAS = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "com", "para", "por",
]);
export function toNomeProprio(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => {
      if (i > 0 && PT_PARTICULAS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
