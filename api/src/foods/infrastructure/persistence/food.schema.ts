import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  FOOD_CATEGORIES,
  type FoodCategory,
} from '../../domain/entities/food.entity';

@Schema({
  collection: 'aliments',
  _id: false,
  timestamps: true,
  versionKey: false,
})
export class FoodDocumentClass {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, trim: true })
  nom: string;

  @Prop({ type: String, required: true })
  nomNormalise: string;

  @Prop({ type: String, required: true, enum: FOOD_CATEGORIES })
  categorie: FoodCategory;

  @Prop({ type: Number, required: true, min: 0, max: 1000 })
  caloriesKcalPour100g: number;

  @Prop({ type: Number, required: true, min: 0, max: 100 })
  proteinesGPour100g: number;

  @Prop({ type: Number, required: true, min: 0, max: 100 })
  glucidesGPour100g: number;

  @Prop({ type: Number, required: true, min: 0, max: 100 })
  lipidesGPour100g: number;

  createdAt: Date;
  updatedAt: Date;
}

export type FoodDocument = HydratedDocument<FoodDocumentClass>;
export const FoodSchema = SchemaFactory.createForClass(FoodDocumentClass);

// Sert a la fois l'unicite du referentiel et la future recherche par prefixe.
FoodSchema.index({ nomNormalise: 1 }, { unique: true });
FoodSchema.index({ categorie: 1, nomNormalise: 1 });
