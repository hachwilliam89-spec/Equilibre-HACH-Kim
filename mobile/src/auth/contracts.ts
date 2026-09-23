import { z } from "zod";

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
export type Credentials = z.infer<typeof credentialsSchema>;

export const registrationSchema = z.discriminatedUnion("role", [
  credentialsSchema.extend({ role: z.literal("coach") }),
  credentialsSchema.extend({
    role: z.literal("utilisateur"),
    coachCode: z.string().trim().toUpperCase().regex(/^EQ-[A-F0-9]{8}$/, "Saisis le code du coach au format EQ-7A9B2C4D."),
    tailleCm: z.number({ error: "Saisis une taille valide en cm." }).positive("La taille doit être positive."),
    age: z.number({ error: "Saisis un âge valide." }).int("L’âge doit être un nombre entier.").positive("L’âge doit être positif.").optional(),
    sexe: z.enum(["homme", "femme"]).optional(),
  }),
]);
export type Registration = z.infer<typeof registrationSchema>;
