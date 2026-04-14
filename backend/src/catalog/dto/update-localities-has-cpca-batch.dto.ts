import { IsArray, IsBoolean, IsString, MinLength } from 'class-validator';

export class UpdateLocalitiesHasCpcaBatchDto {
  @IsArray()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  ids!: string[];

  @IsBoolean()
  hasCpca!: boolean;
}
