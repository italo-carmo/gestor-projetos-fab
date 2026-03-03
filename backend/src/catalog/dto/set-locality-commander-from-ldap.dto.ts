import { IsString } from 'class-validator';

export class SetLocalityCommanderFromLdapDto {
  @IsString()
  uidOrEmail!: string;
}

