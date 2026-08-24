import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { OdgsaController } from './odgsa.controller';
import { OdgsaService } from './odgsa.service';

@Module({
  imports: [RbacModule],
  controllers: [OdgsaController],
  providers: [OdgsaService],
  exports: [OdgsaService],
})
export class OdgsaModule {}
