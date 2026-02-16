import { IsInt, Min } from 'class-validator';

export class UpdateLocalityRecruitsDto {
  @IsInt()
  @Min(0)
  recruitsFemaleCountCurrent: number;
}
