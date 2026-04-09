import { IsString } from 'class-validator';

export class CreateCipavdLocalityDto {
  @IsString()
  code: string;

  @IsString()
  name: string;
}
