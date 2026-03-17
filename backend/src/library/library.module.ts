import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';
import { LibraryUploadsController } from './library-uploads.controller';

@Module({
  imports: [RbacModule],
  controllers: [LibraryController, LibraryUploadsController],
  providers: [LibraryService],
})
export class LibraryModule {}
