import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [RbacModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}

