import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createPlanSchema = z
  .object({
    userId: z.string().min(1).describe("Identifiant de l'utilisateur cible"),
    poidsDepart: z.number().positive().describe('Poids de depart, en kg'),
    poidsCible: z.number().positive().describe('Poids cible, en kg'),
    dateDebut: z.coerce.date().describe('Date de debut du plan'),
    dateCible: z.coerce.date().describe('Date cible du plan'),
    niveauActivite: z
      .enum(['sedentaire', 'actif', 'sportif', 'athlete'])
      .describe(
        "Niveau d'activite (saisi par le coach ; deduction automatique via montre connectee prevue en backlog)",
      ),
    budgetCalorique: z
      .number()
      .positive()
      .optional()
      .describe(
        "Budget calorique impose par le coach ; si absent, calcule automatiquement (Mifflin-St Jeor + facteur d'activite + rythme du plan)",
      ),
  })
  // Doublon volontaire avec Plan.create() (meme logique que RegisterDto /
  // User.create()) : renvoie un 400 explicite au plus tot pour les regles
  // qui ne dependent que de la forme de la requete, pas des donnees du
  // profil utilisateur (celles-la restent dans le domaine).
  .refine((data) => data.dateCible.getTime() > data.dateDebut.getTime(), {
    message:
      'La date cible doit etre strictement posterieure a la date de debut',
    path: ['dateCible'],
  })
  .refine((data) => data.poidsCible !== data.poidsDepart, {
    message: 'Le poids cible doit etre different du poids de depart',
    path: ['poidsCible'],
  });

export class CreatePlanDto extends createZodDto(createPlanSchema) {}
