import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class RecruitDesignationItemDto {
  @IsString()
  destinationLocalityId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignedCount: number;
}

export class UpdateLocalityRecruitDesignationsDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => RecruitDesignationItemDto)
  items: RecruitDesignationItemDto[];
}
