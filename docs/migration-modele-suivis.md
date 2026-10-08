# Migration MongoDB vers l’agrégat `suivis`

Cette migration transforme les plans et mesures existants en un document de
suivi par utilisateur et imbrique le profil métabolique dans `users.profil`.
Elle conserve les UUID et ne modifie pas les contrats HTTP.

## Procédure

1. Arrêter les écritures de l’API pendant la migration.
2. Sauvegarder les collections `users`, `plans`, `measurements` et
   `refresh_tokens` avec `mongodump`.
3. Exécuter une simulation : `pnpm --dir api migrate:suivis`.
4. Vérifier les nombres affichés et corriger toute anomalie signalée.
5. Exécuter : `pnpm --dir api migrate:suivis -- --apply`.
6. Démarrer la nouvelle API et réaliser la recette des plans, mesures,
   historiques, autorisations et accès concurrents.
7. Après validation et nouvelle sauvegarde, supprimer les anciennes
   collections avec `pnpm --dir api migrate:suivis -- --apply --drop-legacy`.

Un utilisateur qui possède déjà un document `suivis` (créé par la nouvelle API)
est conservé tel quel : la migration ne le remplace pas, pour ne pas perdre un
plan, des mesures ou un journal alimentaire plus récents que les anciennes
collections. Le compteur `suivisExistantsConserves` l’indique.

Avant la remise en service de la nouvelle API, la commande est réexécutable :
chaque document `suivis` est remplacé par la projection déterministe des données
sources. Elle ne doit plus être relancée après la reprise des écritures, car
les collections historiques ne contiennent alors plus les nouvelles données.
Elles ne sont jamais supprimées sans l’option explicite `--drop-legacy`.

La migration s’arrête sans écrire si un utilisateur possède plusieurs plans
actifs, si une mesure référence un utilisateur ou un plan introuvable, ou si
le suivi contient plus de 1 000 mesures dans les trois mois calendaires
glissants.
Elle conserve les anciens plans encore référencés par une mesure récente et la
dernière mesure valide du plan actif, même si celle-ci est plus ancienne.

Les écritures courantes sont ACID au niveau d'un document `suivis` : plan,
mesure, dernière valeur, blocage journalier et version changent atomiquement.
La migration, exécutée en maintenance, s'appuie sur la sauvegarde et la
validation avant suppression plutôt que sur une transaction multi-collections.

## Retour arrière

Tant que les collections historiques sont présentes, redéployer la version
précédente de l’API suffit. Après leur suppression, restaurer le dump avant de
redéployer cette version. Ne jamais utiliser `--drop-legacy` avant validation
fonctionnelle et contrôle des volumes.

Le parcours complet du script se vérifie sur une base éphémère dédiée avec
`pnpm --dir api test:migrate-suivis`. Le test couvre le mode simulation,
l’application réexécutable, l’imbrication du profil et la suppression explicite
des collections historiques, puis supprime sa base de test.
