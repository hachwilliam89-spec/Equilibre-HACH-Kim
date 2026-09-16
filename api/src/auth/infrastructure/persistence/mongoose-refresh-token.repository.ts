import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RefreshTokenRecord } from '../../domain/entities/refresh-token-record.entity';
import { RefreshTokenRepositoryPort } from '../../domain/ports/refresh-token-repository.port';
import {
  RefreshTokenDocument,
  RefreshTokenDocumentClass,
} from './refresh-token.schema';

@Injectable()
export class MongooseRefreshTokenRepository implements RefreshTokenRepositoryPort {
  constructor(
    @InjectModel(RefreshTokenDocumentClass.name)
    private readonly model: Model<RefreshTokenDocument>,
  ) {}

  async save(record: RefreshTokenRecord): Promise<RefreshTokenRecord> {
    const props = record.toProps();
    const doc = await this.model.findByIdAndUpdate(
      props.id,
      { $set: props },
      { upsert: true, returnDocument: 'after' },
    );
    return this.toDomain(doc);
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const doc = await this.model.findOne({ tokenHash }).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async revokeByTokenHash(tokenHash: string): Promise<boolean> {
    // Operation atomique "revoque uniquement si encore valide" : le filtre
    // (revoked: false, expiresAt futur) et la mise a jour sont executes en
    // une seule requete Mongo, donc deux requetes concurrentes sur le meme
    // tokenHash ne peuvent pas toutes les deux reussir -- une seule modifie
    // le document, l'autre voit modifiedCount === 0.
    const result = await this.model.updateOne(
      { tokenHash, revoked: false, expiresAt: { $gt: new Date() } },
      { $set: { revoked: true } },
    );
    return result.modifiedCount === 1;
  }

  private toDomain(doc: RefreshTokenDocument): RefreshTokenRecord {
    return RefreshTokenRecord.create({
      id: doc._id.toString(),
      userId: doc.userId,
      tokenHash: doc.tokenHash,
      expiresAt: doc.expiresAt,
      revoked: doc.revoked,
      createdAt: doc.createdAt,
    });
  }
}
