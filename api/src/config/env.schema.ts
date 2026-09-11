import { z } from 'zod';

/**
 * Schéma de validation des variables d'environnement.
 * Exécuté une seule fois au démarrage via ConfigModule.forRoot({ validate }).
 * Si une variable manque ou est invalide, l'application refuse de démarrer
 * avec un message explicite plutôt que de planter plus tard au premier usage.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  // Port d'ecoute INTERNE de l'application, toujours 3000 dans le conteneur.
  // A ne pas confondre avec API_PORT, qui est le port publie sur la machine
  // hote par Docker : celui-la n'est jamais injecte dans le conteneur et ne
  // concerne pas l'application.
  PORT: z.coerce.number().int().positive().default(3000),

  MONGO_URI: z
    .string()
    .refine(
      (val) => val.startsWith('mongodb://') || val.startsWith('mongodb+srv://'),
      { message: 'MONGO_URI doit commencer par mongodb:// ou mongodb+srv://' },
    ),

  // Secrets JWT : 32 caractères minimum (recommandation standard pour HS256)
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET doit contenir au moins 32 caractères'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET doit contenir au moins 32 caractères'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Fonction passée à ConfigModule.forRoot({ validate: validateEnv }).
 * NestJS l'appelle automatiquement avec process.env au démarrage.
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuration d'environnement invalide :\n${issues}`);
  }

  return result.data;
}
