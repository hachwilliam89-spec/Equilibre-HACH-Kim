import { z } from "zod";
import { nomSchema, prenomSchema } from "../identity/identity";

export const credentialsSchema = z.object({
  email: z.string().trim().email("Saisis une adresse e-mail valide."),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
    .refine(
      (value) => new TextEncoder().encode(value).length <= 72,
      "Le mot de passe dépasse la longueur autorisée.",
    ),
});
export const tokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});
export const sessionSchema = tokensSchema.extend({
  coachCode: z.string().optional(),
  role: z.enum(["coach", "utilisateur"]),
  userId: z.string().uuid(),
});
export type Session = z.infer<typeof sessionSchema>;

/**
 * Session expirée (refresh token refusé). Les données de l'appareil sont
 * conservées : elles repartent après une reconnexion avec le même compte.
 */
export const SESSION_EXPIRED_MESSAGE =
  "Votre session a expiré. Reconnectez-vous : vos saisies enregistrées sur ce téléphone sont conservées et seront envoyées.";
export type Credentials = z.infer<typeof credentialsSchema>;

const registrationBase = credentialsSchema.extend({ prenom: prenomSchema, nom: nomSchema });

export const registrationSchema = z.discriminatedUnion("role", [
  registrationBase.extend({ role: z.literal("coach") }),
  registrationBase.extend({
    role: z.literal("utilisateur"),
    coachCode: z.string().trim().toUpperCase().regex(/^EQ-[A-F0-9]{8}$/, "Saisis le code du coach au format EQ-7A9B2C4D."),
    tailleCm: z.number({ error: "Saisis une taille valide en cm." }).positive("La taille doit être positive."),
    age: z.number({ error: "Saisis un âge valide." }).int("L’âge doit être un nombre entier.").positive("L’âge doit être positif.").optional(),
    sexe: z.enum(["homme", "femme"]).optional(),
  }),
]);
export type Registration = z.infer<typeof registrationSchema>;
