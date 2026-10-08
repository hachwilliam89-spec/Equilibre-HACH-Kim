import { HttpStatus } from '@nestjs/common';
import type { User } from '../../auth/domain/entities/user.entity';
import type { UserRepositoryPort } from '../../auth/domain/ports/user-repository.port';
import { AppException } from '../../common/errors/app-exception';

/** Règle d'accès : un coach ne voit que les utilisateurs qui lui sont rattachés. */
export async function chargerClientDuCoach(
  users: UserRepositoryPort,
  coachId: string,
  userId: string,
): Promise<User> {
  const user = await users.findById(userId);
  if (!user || user.role !== 'utilisateur' || user.coachId !== coachId) {
    throw new AppException(
      'forbidden',
      'Cet utilisateur ne vous est pas rattache',
      HttpStatus.FORBIDDEN,
    );
  }
  return user;
}
