import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { EloRolesController } from './elo-roles.controller';
import { LocalitiesController } from './localities.controller';
import { PostosController } from './postos.controller';
import { SpecialtiesController } from './specialties.controller';

@Module({
  imports: [RbacModule],
  controllers: [LocalitiesController, SpecialtiesController, EloRolesController, PostosController],
})
export class CatalogModule {}

