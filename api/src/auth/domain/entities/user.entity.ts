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

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  // Champs nécessaires au calcul métabolique (US1) — pertinents pour role='utilisateur'
  tailleCm?: number;
  age?: number;
  sexe?: 'homme' | 'femme';
  // Rattachement : un utilisateur est rattaché à un coach (règle d'accès par rôle)
  coachId?: string;
  createdAt: Date;
}

export class User {
  private constructor(private readonly props: UserProps) {}

  static create(props: UserProps): User {
    if (!EMAIL_SHAPE_REGEX.test(props.email)) {
      throw new Error('Email invalide');
    }
    if (props.role === 'utilisateur' && !props.coachId) {
      // Règle métier : un utilisateur doit être rattaché à un coach pour respecter
      // la règle d'accès ("un coach ne voit que les utilisateurs qui lui sont rattachés")
      throw new Error('Un utilisateur doit être rattaché à un coach');
    }
    return new User(props);
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

  toProps(): UserProps {
    return { ...this.props };
  }
}
