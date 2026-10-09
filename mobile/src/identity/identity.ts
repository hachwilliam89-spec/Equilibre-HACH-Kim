import { z } from "zod";

/** Même limite que l'API (domaine User). */
export const IDENTITY_MAX_LENGTH = 50;

const identityField = (label: "prénom" | "nom") =>
  z
    .string({ error: `Saisis ton ${label}.` })
    .trim()
    .min(1, `Saisis ton ${label}.`)
    .max(IDENTITY_MAX_LENGTH, `Ton ${label} ne doit pas dépasser ${IDENTITY_MAX_LENGTH} caractères.`);

export const prenomSchema = identityField("prénom");
export const nomSchema = identityField("nom");
export const identitySchema = z.object({ prenom: prenomSchema, nom: nomSchema });
export type Identity = z.infer<typeof identitySchema>;

/** Personne telle que renvoyée par l'API : identité facultative (anciens comptes). */
export interface Person {
  email: string;
  prenom?: string;
  nom?: string;
}

export const hasIdentity = (person: Partial<Person> | null | undefined): boolean =>
  !!(person?.prenom?.trim() && person?.nom?.trim());

/** « Paul Martin », ou l'e-mail tant que l'identité n'est pas renseignée. */
export function displayName(person: Person): string {
  return hasIdentity(person) ? `${person.prenom!.trim()} ${person.nom!.trim()}` : person.email;
}

/** Pastille : « PM », ou la première lettre de l'e-mail. */
export function initials(person: Person): string {
  if (hasIdentity(person)) {
    return `${firstLetter(person.prenom!)}${firstLetter(person.nom!)}`;
  }
  return firstLetter(person.email);
}

function firstLetter(value: string): string {
  return Array.from(value.trim())[0]?.toLocaleUpperCase("fr-FR") ?? "?";
}

/** Sans accents ni casse : « Éloïse » et « eloise » se valent. */
export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr-FR").trim();
}

/** Recherche du coach : chaque mot saisi doit apparaître dans le prénom, le nom ou l'e-mail. */
export function matchesSearch(person: Person, query: string): boolean {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeSearch(`${person.prenom ?? ""} ${person.nom ?? ""} ${person.email}`);
  return words.every((word) => haystack.includes(word));
}

const DAY_MS = 86_400_000;

/** « aujourd’hui », « hier », « il y a 3 jours » (jours calendaires locaux). */
export function lastActivityLabel(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "Aucune activité";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Aucune activité";
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / DAY_MS);
  if (days <= 0) return "Actif aujourd’hui";
  if (days === 1) return "Actif hier";
  return `Inactif depuis ${days} jours`;
}
