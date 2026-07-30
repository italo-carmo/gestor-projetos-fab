import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { InstitutionalService } from './institutional.service';

@Controller('institutional')
export class InstitutionalController {
  constructor(private readonly institutional: InstitutionalService) {}

  @Get()
  async getPageData(@Res({ passthrough: true }) response: Response) {
    response.setHeader(
      'Cache-Control',
      'public, max-age=60, stale-while-revalidate=300',
    );
    return this.institutional.getPageData();
  }

  @Get('library-photos/:id')
  async getLibraryPhoto(@Param('id') id: string, @Res() response: Response) {
    const photo = await this.institutional.getLibraryPhoto(id);
    response.setHeader('Content-Type', photo.contentType);
    response.setHeader('Cache-Control', 'public, max-age=3600');
    return response.send(photo.buffer);
  }

  @Get('news/:id/photo')
  async getNewsPhoto(@Param('id') id: string, @Res() response: Response) {
    const photo = await this.institutional.getNewsPhoto(id);
    response.setHeader('Content-Type', photo.contentType);
    response.setHeader('Cache-Control', 'public, max-age=3600');
    return response.send(photo.buffer);
  }

  @Get('materials/:id')
  async downloadMaterial(@Param('id') id: string, @Res() response: Response) {
    const material = await this.institutional.getMaterial(id);
    response.setHeader('Cache-Control', 'public, max-age=600');
    if (material.mimeType) {
      response.setHeader('Content-Type', material.mimeType);
    }
    return response.download(material.filePath, material.fileName);
  }
}
