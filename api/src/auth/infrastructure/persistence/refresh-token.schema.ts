import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RefreshTokenDocument = RefreshTokenDocumentClass &
  Omit<Document, '_id'>;

@Schema({ timestamps: true, collection: 'refresh_tokens', _id: false })
export class RefreshTokenDocumentClass {
  // Meme raison que UserDocumentClass : id applicatif opaque, pas un ObjectId.
  @Prop({ type: String })
  _id: string;

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
