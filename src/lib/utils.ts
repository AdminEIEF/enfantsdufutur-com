import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sort classes by cycle ordre → niveau ordre → class name.
 * Works with any class object that has a nested niveaux relation.
 * Handles various shapes: niveaux.ordre, niveaux.cycles.ordre, etc.
 */
export function sortClasses<T extends Record<string, any>>(classes: T[]): T[] {
  return [...classes].sort((a, b) => {
    const nA = a.niveaux || a.classes?.niveaux;
    const nB = b.niveaux || b.classes?.niveaux;
    // Cycle ordre
    const cycleA = nA?.cycles?.ordre ?? nA?.cycle_ordre ?? 0;
    const cycleB = nB?.cycles?.ordre ?? nB?.cycle_ordre ?? 0;
    if (cycleA !== cycleB) return cycleA - cycleB;
    // Niveau ordre
    const ordreA = nA?.ordre ?? 0;
    const ordreB = nB?.ordre ?? 0;
    if (ordreA !== ordreB) return ordreA - ordreB;
    // Class name alphabetical
    const nomA = (a.nom || '').toLowerCase();
    const nomB = (b.nom || '').toLowerCase();
    return nomA.localeCompare(nomB, 'fr');
  });
}
