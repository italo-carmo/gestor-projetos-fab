import { IsOptional, IsString } from 'class-validator';

export class CreateChecklistItemDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  taskTemplateId?: string | null;
}

