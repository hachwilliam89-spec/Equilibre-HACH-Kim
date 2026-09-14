import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RefreshTokenDocument = RefreshTokenDocumentClass & Document;

@Schema({ timestamps: true, collection: 'refresh_tokens' })
export class RefreshTokenDocumentClass {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  revoked: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(
  RefreshTokenDocumentClass,
);

// Index TTL : MongoDB supprime automatiquement le document une fois
// expiresAt atteint -- pas besoin d'un job de nettoyage separe pour purger
// les vieux tokens expires.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
