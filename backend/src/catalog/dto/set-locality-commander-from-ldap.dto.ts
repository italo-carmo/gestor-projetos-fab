import { IsString } from 'class-validator';

export class SetLocalityCommanderFromLdapDto {
  @IsString()
  uid!: string;
}

