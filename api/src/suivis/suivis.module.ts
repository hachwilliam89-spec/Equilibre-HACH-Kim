import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SUIVI_REPOSITORY } from './domain/ports/suivi-repository.port';
import { MongooseSuiviRepository } from './infrastructure/persistence/mongoose-suivi.repository';
import {
  SuiviDocumentClass,
  SuiviSchema,
} from './infrastructure/persistence/suivi.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SuiviDocumentClass.name, schema: SuiviSchema },
    ]),
  ],
  providers: [
    MongooseSuiviRepository,
    { provide: SUIVI_REPOSITORY, useExisting: MongooseSuiviRepository },
  ],
  exports: [SUIVI_REPOSITORY, MongooseModule],
})
export class SuivisModule {}
