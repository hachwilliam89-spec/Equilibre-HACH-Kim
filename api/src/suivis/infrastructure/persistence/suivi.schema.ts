import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import type { MeasurementProps } from '../../../measurements/domain/entities/measurement.entity';
import type { PlanProps } from '../../../plans/domain/entities/plan.entity';

const PlanEmbeddedSchema = new MongooseSchema(
  {
    id: { type: String, required: true },
    userId: { type: String, required: true },
    coachId: { type: String, required: true },
    poidsDepart: { type: Number, required: true },
    poidsCible: { type: Number, required: true },
    dateDebut: { type: Date, required: true },
    dateCible: { type: Date, required: true },
    imcCible: { type: Number, required: true },
    niveauActivite: {
      type: String,
      required: true,
      enum: ['sedentaire', 'actif', 'sportif', 'athlete'],
    },
    budgetCalorique: { type: Number, required: true },
    budgetPlafonneAuBmr: { type: Boolean, required: true },
    statut: {
      type: String,
      required: true,
      enum: ['actif', 'termine', 'annule'],
    },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const MeasurementEmbeddedSchema = new MongooseSchema(
  {
    id: { type: String, required: true },
    userId: { type: String, required: true },
    planId: { type: String, required: true },
    poidsKg: {
      type: Number,
      required: true,
      validate: {
        validator: (value: number) => Number.isFinite(value) && value > 0,
        message: 'Le poids doit être strictement positif',
      },
    },
    receivedAt: { type: Date, required: true },
    jourUtc: { type: String, required: true },
    source: {
      type: String,
      required: true,
      enum: ['automatique', 'manuelle'],
    },
    statut: {
      type: String,
      required: true,
      enum: ['valide', 'suspecte', 'hors-plan'],
    },
  },
  { _id: false },
);

@Schema({
  collection: 'suivis',
  _id: false,
  timestamps: true,
  versionKey: false,
})
export class SuiviDocumentClass {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: Number, required: true, default: 0 })
  version: number;

  @Prop({ type: PlanEmbeddedSchema, default: null })
  planActif: PlanProps | null;

  @Prop({ type: [PlanEmbeddedSchema], default: [] })
  plans: PlanProps[];

  @Prop({ type: [MeasurementEmbeddedSchema], default: [] })
  mesures: MeasurementProps[];

  @Prop({ type: MeasurementEmbeddedSchema, default: null })
  derniereMesureValide: MeasurementProps | null;

  @Prop({
    type: new MongooseSchema(
      { jourUtc: String, mesureId: String },
      { _id: false },
    ),
    default: null,
  })
  blocageJournalier: { jourUtc: string; mesureId: string } | null;
}

export type SuiviDocument = HydratedDocument<SuiviDocumentClass>;
export const SuiviSchema = SchemaFactory.createForClass(SuiviDocumentClass);
