import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import type { MeasurementProps } from '../../../measurements/domain/entities/measurement.entity';
import type { PlanProps } from '../../../plans/domain/entities/plan.entity';
import {
  MEAL_CATEGORIES,
  type FoodEntryProps,
} from '../../../nutrition/domain/entities/food-entry.entity';

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

const FoodSnapshotEmbeddedSchema = new MongooseSchema(
  {
    id: { type: String, required: true },
    nom: { type: String, required: true },
    caloriesKcalPour100g: { type: Number, required: true, min: 0 },
    proteinesGPour100g: { type: Number, required: true, min: 0 },
    glucidesGPour100g: { type: Number, required: true, min: 0 },
    lipidesGPour100g: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const FoodEntryEmbeddedSchema = new MongooseSchema(
  {
    id: { type: String, required: true },
    aliment: { type: FoodSnapshotEmbeddedSchema, required: true },
    quantiteGrammes: { type: Number, required: true, min: 0 },
    caloriesKcal: { type: Number, required: true, min: 0 },
    proteinesG: { type: Number, required: true, min: 0 },
    glucidesG: { type: Number, required: true, min: 0 },
    lipidesG: { type: Number, required: true, min: 0 },
    categorieRepas: {
      type: String,
      enum: MEAL_CATEGORIES,
      default: 'non-classe',
    },
    receivedAt: { type: Date, required: true },
  },
  { _id: false },
);

const DailyFoodJournalEmbeddedSchema = new MongooseSchema(
  {
    planId: { type: String, required: true },
    jourUtc: { type: String, required: true },
    budgetCalorique: { type: Number, required: true, min: 0 },
    entrees: { type: [FoodEntryEmbeddedSchema], default: [] },
    totalCaloriesKcal: { type: Number, required: true, min: 0 },
    totalProteinesG: { type: Number, required: true, min: 0 },
    totalGlucidesG: { type: Number, required: true, min: 0 },
    totalLipidesG: { type: Number, required: true, min: 0 },
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

  @Prop({ type: [DailyFoodJournalEmbeddedSchema], default: [] })
  journauxAlimentaires: {
    planId: string;
    jourUtc: string;
    budgetCalorique: number;
    entrees: FoodEntryProps[];
    totalCaloriesKcal: number;
    totalProteinesG: number;
    totalGlucidesG: number;
    totalLipidesG: number;
  }[];
}

export type SuiviDocument = HydratedDocument<SuiviDocumentClass>;
export const SuiviSchema = SchemaFactory.createForClass(SuiviDocumentClass);
