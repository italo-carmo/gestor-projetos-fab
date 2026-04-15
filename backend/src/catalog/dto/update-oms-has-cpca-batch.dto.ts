import { ArrayNotEmpty, IsArray, IsBoolean, IsString } from 'class-validator';

export class UpdateOmsHasCpcaBatchDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];

  @IsBoolean()
  hasCpca!: boolean;
}
