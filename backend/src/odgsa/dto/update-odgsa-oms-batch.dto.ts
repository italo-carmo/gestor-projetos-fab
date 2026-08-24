import { ArrayNotEmpty, IsArray, IsIn, IsString } from 'class-validator';

export class UpdateOdgsaOmsBatchDto {
  @IsIn(['ASSIGN', 'UNASSIGN'])
  action!: 'ASSIGN' | 'UNASSIGN';

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  omIds!: string[];
}
