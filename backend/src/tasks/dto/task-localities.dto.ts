import { IsArray, IsOptional, IsString } from 'class-validator';

export class TaskLocalitiesDto {
  @IsArray()
  @IsString({ each: true })
  localityIds!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourceTaskIds?: string[];
}
