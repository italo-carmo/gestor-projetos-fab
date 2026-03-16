import { IsEmail, MaxLength } from 'class-validator';

export class LookupSocialCommunicationHighlightLdapDto {
  @IsEmail()
  @MaxLength(160)
  email!: string;
}
