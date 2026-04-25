import { Module } from '@nestjs/common';
import { ManualsController } from './manuals.controller';

@Module({
  controllers: [ManualsController],
})
export class ManualsModule {}
