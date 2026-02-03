import { Module } from '@nestjs/common';
import { LocalitiesController } from './localities.controller';
import { SpecialtiesController } from './specialties.controller';

@Module({
  controllers: [LocalitiesController, SpecialtiesController],
})
export class CatalogModule {}

