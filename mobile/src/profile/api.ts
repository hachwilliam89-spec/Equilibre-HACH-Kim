import { z } from "zod";
import { parseApiData } from "../network/http";
import { requestApi } from "../plans/api";

export const profileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  coach: z.object({ id: z.string().uuid(), email: z.string().email() }),
  tailleCm: z.number().positive().optional(),
  age: z.number().int().positive().optional(),
  sexe: z.enum(["homme", "femme"]).optional(),
});

export const profileUpdateSchema = z.object({
  tailleCm: z
    .number({ error: "Saisis une taille valide en cm." })
    .positive("La taille doit être positive."),
  age: z
    .number({ error: "Saisis un âge valide." })
    .int("L’âge doit être un nombre entier.")
    .positive("L’âge doit être positif.")
    .optional(),
  sexe: z.enum(["homme", "femme"]).optional(),
});

export type Profile = z.infer<typeof profileSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export async function getProfile(): Promise<Profile> {
  return parseApiData(profileSchema, await requestApi("/users/me"));
}

export async function updateProfile(profile: ProfileUpdate): Promise<Profile> {
  return parseApiData(profileSchema,
    await requestApi("/users/me/profile", "PATCH", profileUpdateSchema.parse(profile)),
  );
}
