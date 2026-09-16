import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = UserDocumentClass & Omit<Document, '_id'>;

@Schema({ timestamps: true, collection: 'users', _id: false })
export class UserDocumentClass {
  // Id opaque genere par l'application (crypto.randomUUID), pas un
  // ObjectId Mongo : desactive donc la generation automatique ci-dessus.
  @Prop({ type: String })
  _id: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, enum: ['coach', 'utilisateur'] })
  role: 'coach' | 'utilisateur';

  @Prop()
  tailleCm?: number;

  @Prop()
  age?: number;

  @Prop({ enum: ['homme', 'femme'] })
  sexe?: 'homme' | 'femme';

  // Reference vers un autre document User (role coach) -- pertinent si role='utilisateur'
  @Prop({ type: String, ref: 'UserDocumentClass' })
  coachId?: string;

  // Non decorees en @Prop() : gerees automatiquement par { timestamps: true }
  // ci-dessus. Declarees ici uniquement pour que TypeScript connaisse leur
  // existence et leur type, sans avoir besoin d'un cast "as any" cote repository.
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(UserDocumentClass);
