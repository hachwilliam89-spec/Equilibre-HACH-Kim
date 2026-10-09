/**
 * Entité domaine User — indépendante de Mongoose/NestJS.
 * Le domaine ne connaît que cette forme ; c'est l'infrastructure qui la mappe
 * depuis/vers MongoDB.
 */

export type Role = 'coach' | 'utilisateur';

// Verification de forme suffisante pour une entite domaine (la verification
// applicative complete, avec message d'erreur utilisateur, est deja faite en
// amont par le DTO Zod -- ceci est un second filet de securite au niveau
// domaine, pas la validation primaire).
const EMAIL_SHAPE_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Longueur maximale d'un prénom ou d'un nom (après retrait des espaces). */
export const IDENTITE_LONGUEUR_MAX = 50;

/**
 * Normalise un prénom ou un nom : espaces de début/fin retirés, espaces
 * internes multiples réduits. Renvoie undefined pour une valeur absente.
 */
function normaliserIdentite(
  valeur: string | undefined,
  champ: 'prenom' | 'nom',
): string | undefined {
  if (valeur === undefined) return undefined;
  const propre = valeur.trim().replace(/\s+/g, ' ');
  if (propre.length === 0 || propre.length > IDENTITE_LONGUEUR_MAX) {
    throw new Error(champ === 'prenom' ? 'Prenom invalide' : 'Nom invalide');
  }
  return propre;
}

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  // Identité affichée (coach et utilisateur). Facultative en base pour les
  // comptes créés avant son introduction ; obligatoire à l'inscription.
  prenom?: string;
  nom?: string;
  // Champs nécessaires au calcul métabolique (US1) — pertinents pour role='utilisateur'
  tailleCm?: number;
  age?: number;
  sexe?: 'homme' | 'femme';
  // Rattachement : un utilisateur est rattaché à un coach (règle d'accès par rôle)
  coachId?: string;
  createdAt: Date;
}

export interface UserProfile {
  prenom?: string;
  nom?: string;
  tailleCm?: number;
  age?: number;
  sexe?: 'homme' | 'femme';
}

export class User {
  private constructor(private readonly props: UserProps) {}

  static create(props: UserProps): User {
    // Email normalise en minuscules (et sans espaces) : findByEmail interroge
    // en minuscules, donc stocker la casse d'origine rendrait impossible la
    // reconnexion d'un compte cree avec une majuscule.
    const email = props.email.trim().toLowerCase();
    if (!EMAIL_SHAPE_REGEX.test(email)) {
      throw new Error('Email invalide');
    }
    if (props.role === 'utilisateur' && !props.coachId) {
      // Règle métier : un utilisateur doit être rattaché à un coach pour respecter
      // la règle d'accès ("un coach ne voit que les utilisateurs qui lui sont rattachés")
      throw new Error('Un utilisateur doit être rattaché à un coach');
    }
    return new User({
      ...props,
      email,
      prenom: normaliserIdentite(props.prenom, 'prenom'),
      nom: normaliserIdentite(props.nom, 'nom'),
    });
  }

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get role(): Role {
    return this.props.role;
  }

  get prenom(): string | undefined {
    return this.props.prenom;
  }

  get nom(): string | undefined {
    return this.props.nom;
  }

  /** Prénom et nom renseignés : le compte peut être présenté par son nom. */
  hasIdentity(): boolean {
    return !!(this.props.prenom && this.props.nom);
  }

  get coachId(): string | undefined {
    return this.props.coachId;
  }

  /** Profil métabolique complet, nécessaire au calcul du BMR (US1) */
  hasCompleteMetabolicProfile(): boolean {
    return !!(this.props.tailleCm && this.props.age && this.props.sexe);
  }

  get tailleCm(): number | undefined {
    return this.props.tailleCm;
  }

  get age(): number | undefined {
    return this.props.age;
  }

  get sexe(): 'homme' | 'femme' | undefined {
    return this.props.sexe;
  }

  /** Applique les champs fournis ; un champ absent ou undefined est conservé. */
  withProfile(profile: UserProfile): User {
    const fournis = Object.fromEntries(
      Object.entries(profile).filter(([, value]) => value !== undefined),
    ) as UserProfile;
    return User.create({
      ...this.props,
      ...fournis,
    });
  }

  toProps(): UserProps {
    return { ...this.props };
  }
}
