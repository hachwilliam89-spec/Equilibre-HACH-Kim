import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type {
  MeasurementSource,
  MeasurementStatut,
} from '../../domain/entities/measurement.entity';

@Schema({ collection: 'measurements', _id: false, versionKey: false })
export class MeasurementDocumentClass {
  @Prop({ type: String, required: true, trim: true })
  _id: string;

  @Prop({ type: String, required: true, trim: true, ref: 'UserDocumentClass' })
  userId: string;

  @Prop({ type: String, required: true, trim: true, ref: 'PlanDocumentClass' })
  planId: string;

  @Prop({
    type: Number,
    required: true,
    validate: (value: number) => Number.isFinite(value) && value > 0,
  })
  poidsKg: number;

  @Prop({ type: Date, required: true })
  receivedAt: Date;

  @Prop({ type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ })
  jourUtc: string;

  @Prop({ type: String, required: true, enum: ['automatique', 'manuelle'] })
  source: MeasurementSource;

  @Prop({
    type: String,
    required: true,
    enum: ['valide', 'suspecte', 'hors-plan'],
  })
  statut: MeasurementStatut;
}

export type MeasurementDocument = HydratedDocument<MeasurementDocumentClass>;
export const MeasurementSchema = SchemaFactory.createForClass(
  MeasurementDocumentClass,
);

MeasurementSchema.pre('validate', function () {
  if (
    this.receivedAt instanceof Date &&
    Number.isFinite(this.receivedAt.getTime())
  ) {
    this.jourUtc = this.receivedAt.toISOString().slice(0, 10);
  }
});

MeasurementSchema.index({ userId: 1, receivedAt: -1, _id: -1 });
MeasurementSchema.index(
  { userId: 1, jourUtc: 1 },
  {
    unique: true,
    partialFilterExpression: { statut: 'valide' },
    name: 'one_valid_measurement_per_user_day',
  },
);
