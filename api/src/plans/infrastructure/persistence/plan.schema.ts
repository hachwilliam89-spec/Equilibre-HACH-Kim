import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlanDocument = PlanDocumentClass & Omit<Document, '_id'>;

@Schema({ timestamps: true, collection: 'plans', _id: false })
export class PlanDocumentClass {
  // Id opaque genere par l'application (crypto.randomUUID), meme convention
  // que UserDocumentClass / RefreshTokenDocumentClass.
  @Prop({ type: String })
  _id: string;

  @Prop({ type: String, required: true, ref: 'UserDocumentClass' })
  userId: string;

  @Prop({ type: String, required: true, ref: 'UserDocumentClass' })
  coachId: string;

  @Prop({ required: true })
  poidsDepart: number;

  @Prop({ required: true })
  poidsCible: number;

  @Prop({ required: true })
  dateDebut: Date;

  @Prop({ required: true })
  dateCible: Date;

  @Prop({ required: true })
  imcCible: number;

  @Prop({
    required: true,
    enum: ['sedentaire', 'actif', 'sportif', 'athlete'],
  })
  niveauActivite: 'sedentaire' | 'actif' | 'sportif' | 'athlete';

  @Prop({ required: true })
  budgetCalorique: number;

  @Prop({ required: true })
  budgetPlafonneAuBmr: boolean;

  @Prop({ required: true, enum: ['actif', 'termine', 'annule'] })
  statut: 'actif' | 'termine' | 'annule';

  createdAt: Date;
  updatedAt: Date;
}

export const PlanSchema = SchemaFactory.createForClass(PlanDocumentClass);
