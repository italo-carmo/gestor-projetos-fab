import { IsString, MaxLength } from 'class-validator';

export class CreateActivityTypeDto {
  @IsString()
  @MaxLength(120)
  name: string;
}

