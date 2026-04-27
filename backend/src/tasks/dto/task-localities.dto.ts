import { ActivityScope } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class TaskLocalitiesDto {
  @IsOptional()
  @IsEnum(ActivityScope)
  scope?: ActivityScope;

  @IsArray()
  @IsString({ each: true })
  localityIds!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourceTaskIds?: string[];
}
