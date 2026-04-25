import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { ManualsController } from './manuals.controller';

@Module({
  imports: [RbacModule],
  controllers: [ManualsController],
})
export class ManualsModule {}
