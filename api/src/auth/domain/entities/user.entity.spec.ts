import { User } from './user.entity';

const baseProps = {
  id: 'user-id',
  email: 'coach@equilibre.app',
  passwordHash: 'hashed-password',
  createdAt: new Date('2026-01-01'),
};

describe('User (entite domaine)', () => {
  it('cree un coach sans coachId', () => {
    const user = User.create({ ...baseProps, role: 'coach' });

    expect(user.role).toBe('coach');
    expect(user.coachId).toBeUndefined();
  });

  it('normalise l email en minuscules et sans espaces (permet la reconnexion)', () => {
    const user = User.create({
      ...baseProps,
      email: '  Coach@Equilibre.APP  ',
      role: 'coach',
    });

    expect(user.email).toBe('coach@equilibre.app');
  });

  it('cree un utilisateur rattache a un coach', () => {
    const user = User.create({
      ...baseProps,
      role: 'utilisateur',
      coachId: 'coach-id',
    });

    expect(user.role).toBe('utilisateur');
    expect(user.coachId).toBe('coach-id');
  });

  it('refuse un utilisateur sans coachId', () => {
    expect(() => User.create({ ...baseProps, role: 'utilisateur' })).toThrow(
      'Un utilisateur doit être rattaché à un coach',
    );
  });

  it.each([
    'pas-un-email',
    'sans-arobase.com',
    'presque@sans-domaine',
    '@manque-la-partie-locale.com',
  ])('refuse un email mal forme : %s', (email) => {
    expect(() => User.create({ ...baseProps, email, role: 'coach' })).toThrow(
      'Email invalide',
    );
  });

  it.each(['coach@equilibre.app', 'prenom.nom@sous.domaine.fr'])(
    'accepte un email bien forme : %s',
    (email) => {
      expect(() =>
        User.create({ ...baseProps, email, role: 'coach' }),
      ).not.toThrow();
    },
  );

  it('expose le profil metabolique complet uniquement si taille/age/sexe sont tous renseignes', () => {
    const incomplete = User.create({ ...baseProps, role: 'coach' });
    expect(incomplete.hasCompleteMetabolicProfile()).toBe(false);

    const complete = User.create({
      ...baseProps,
      role: 'coach',
      tailleCm: 180,
      age: 30,
      sexe: 'homme',
    });
    expect(complete.hasCompleteMetabolicProfile()).toBe(true);
  });

  it('met a jour le profil sans modifier les donnees du compte', () => {
    const user = User.create({
      ...baseProps,
      role: 'utilisateur',
      coachId: 'coach-id',
    });
    const updated = user.withProfile({
      tailleCm: 172,
      age: 31,
      sexe: 'femme',
    });

    expect(updated.email).toBe(user.email);
    expect(updated.coachId).toBe(user.coachId);
    expect(updated.tailleCm).toBe(172);
    expect(updated.age).toBe(31);
    expect(updated.sexe).toBe('femme');
  });

  describe('identite (prenom, nom)', () => {
    it('normalise le prenom et le nom (espaces retires et reduits)', () => {
      const user = User.create({
        ...baseProps,
        role: 'coach',
        prenom: '  Marie   Claire ',
        nom: ' Dupont ',
      });

      expect(user.prenom).toBe('Marie Claire');
      expect(user.nom).toBe('Dupont');
      expect(user.hasIdentity()).toBe(true);
    });

    it('accepte un compte existant sans identite', () => {
      const user = User.create({ ...baseProps, role: 'coach' });

      expect(user.prenom).toBeUndefined();
      expect(user.hasIdentity()).toBe(false);
    });

    it('refuse un prenom vide une fois les espaces retires', () => {
      expect(() =>
        User.create({
          ...baseProps,
          role: 'coach',
          prenom: '   ',
          nom: 'Dupont',
        }),
      ).toThrow('Prenom invalide');
    });

    it('refuse un nom de plus de 50 caracteres', () => {
      expect(() =>
        User.create({
          ...baseProps,
          role: 'coach',
          prenom: 'Marie',
          nom: 'x'.repeat(51),
        }),
      ).toThrow('Nom invalide');
    });

    it('accepte un nom de 50 caracteres pile', () => {
      const user = User.create({
        ...baseProps,
        role: 'coach',
        prenom: 'Marie',
        nom: 'x'.repeat(50),
      });

      expect(user.nom).toHaveLength(50);
    });

    it('met a jour l identite via withProfile sans toucher au reste', () => {
      const user = User.create({
        ...baseProps,
        role: 'utilisateur',
        coachId: 'coach-id',
        tailleCm: 170,
      }).withProfile({ prenom: 'Paul', nom: 'Martin' });

      expect(user.prenom).toBe('Paul');
      expect(user.nom).toBe('Martin');
      expect(user.tailleCm).toBe(170);
    });
  });
});
