import { z } from 'zod';
import { IDENTITE_LONGUEUR_MAX } from '../../../domain/entities/user.entity';

/** Prénom ou nom : espaces retirés, 1 à 50 caractères. */
function champIdentite(libelle: 'Prenom' | 'Nom') {
  return z
    .string({ error: `${libelle} requis` })
    .trim()
    .min(1, { message: `${libelle} requis` })
    .max(IDENTITE_LONGUEUR_MAX, {
      message: `${libelle} : ${IDENTITE_LONGUEUR_MAX} caracteres maximum`,
    });
}

export const prenomSchema = champIdentite('Prenom').describe('Prenom');
export const nomSchema = champIdentite('Nom').describe('Nom de famille');
