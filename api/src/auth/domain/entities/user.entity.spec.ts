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
});
