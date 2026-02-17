import { IsBoolean, IsString } from 'class-validator';

export class SetUserModuleAccessDto {
  @IsString()
  resource!: string;

  @IsBoolean()
  enabled!: boolean;
}
